package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.adapter.NfeGatewayPort;
import br.com.totaltrigo.erp.adapter.NfeGatewayPort.NfeEmissionResult;
import br.com.totaltrigo.erp.domain.enums.NfeStatus;
import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import br.com.totaltrigo.erp.domain.model.*;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BackofficeService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final ClientRepository clientRepository;
    private final ImportBatchRepository importBatchRepository;
    private final FieldSalesService fieldSalesService;
    private final NfeGatewayPort nfeGatewayPort;

    private final Map<Long, String> emittedXmlStore = new ConcurrentHashMap<>();

    public BackofficeService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            ClientRepository clientRepository,
            ImportBatchRepository importBatchRepository,
            FieldSalesService fieldSalesService,
            NfeGatewayPort nfeGatewayPort
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.clientRepository = clientRepository;
        this.importBatchRepository = importBatchRepository;
        this.fieldSalesService = fieldSalesService;
        this.nfeGatewayPort = nfeGatewayPort;
    }

    @Transactional(readOnly = true)
    public List<BackofficeOrderDto> listOrders(String filterStatus) {
        List<Order> orders;
        if (filterStatus == null || filterStatus.isBlank() || "ALL".equalsIgnoreCase(filterStatus)) {
            orders = orderRepository.findAllByOrderByCreatedAtDesc();
        } else if ("FILA_PRE_NOTA".equalsIgnoreCase(filterStatus)) {
            orders = orderRepository.findByStatusInOrderByCreatedAtDesc(
                    List.of(OrderStatus.AGUARDANDO_REVISAO, OrderStatus.EM_SEPARACAO)
            );
        } else {
            OrderStatus st = OrderStatus.valueOf(filterStatus.toUpperCase());
            orders = orderRepository.findByStatusInOrderByCreatedAtDesc(List.of(st));
        }
        return orders.stream().map(fieldSalesService::toBackofficeOrderDto).toList();
    }

    /**
     * Etapa Intermediária / Pré-Nota:
     * Permite que Gabriel revise os dados cadastrais/fiscais do cliente e altere as quantidades
     * ou valores unitários que efetivamente irão para a Nota Fiscal, ajustando automaticamente
     * a reserva de estoque (reservedStock) e recalculando os snapshots financeiros.
     */
    @Transactional
    public BackofficeOrderDto reviewAndAdjustPreNota(Long orderId, ReviewOrderRequest req) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        if (order.getStatus() == OrderStatus.FATURADO || order.getStatus() == OrderStatus.ENTREGUE || order.getStatus() == OrderStatus.CANCELADO) {
            throw new IllegalStateException("Pedidos com status " + order.getStatus() + " possuem dados financeiros/fiscais bloqueados para edição.");
        }

        // 1. Atualiza dados cadastrais e fiscais do Cliente (ex: após busca na BrasilAPI)
        Client client = order.getClient();
        if (req.clientCorporateName() != null && !req.clientCorporateName().isBlank()) {
            client.setCorporateName(req.clientCorporateName().trim());
        }
        if (req.clientCnpj() != null) client.setCnpj(req.clientCnpj().trim());
        if (req.clientStateRegistration() != null) client.setStateRegistration(req.clientStateRegistration().trim());
        if (req.clientIeIndicator() != null) client.setIeIndicator(req.clientIeIndicator());
        if (req.clientZipCode() != null) client.setZipCode(req.clientZipCode().trim());
        if (req.clientStreet() != null) client.setStreet(req.clientStreet().trim());
        if (req.clientNumber() != null) client.setNumber(req.clientNumber().trim());
        if (req.clientNeighborhood() != null) client.setNeighborhood(req.clientNeighborhood().trim());
        if (req.clientCity() != null) client.setCity(req.clientCity().trim());
        if (req.clientState() != null) client.setState(req.clientState().trim());
        if (req.clientIbgeCityCode() != null) client.setIbgeCityCode(req.clientIbgeCityCode().trim());

        boolean hasValidDoc = client.getCnpj() != null && client.getCnpj().replaceAll("\\D", "").length() >= 11;
        boolean hasValidAddress = client.getStreet() != null && !client.getStreet().isBlank();
        boolean hasValidIbge = client.getIbgeCityCode() != null && client.getIbgeCityCode().trim().length() == 7;
        client.setRegistrationComplete(hasValidDoc && hasValidAddress && hasValidIbge);
        clientRepository.save(client);

        // 2. Atualiza cabeçalho do pedido
        order.setPaymentTerms(req.paymentTerms());
        if (req.deliveryForecast() != null) order.setDeliveryForecast(req.deliveryForecast());
        order.setNotesForInvoiceOrDriver(req.notesForInvoiceOrDriver());
        order.setBackofficeAdjustmentNotes(req.backofficeAdjustmentNotes());
        if (req.shippingCostEstimate() != null) {
            order.setShippingCostEstimate(req.shippingCostEstimate());
        }

        // 3. Ajusta quantidades e valores que vão para a Nota Fiscal vs. Pedido Original da Rua
        Map<Long, ReviewOrderItemUpdateDto> updatesByProduct = new HashMap<>();
        for (ReviewOrderItemUpdateDto u : req.items()) {
            updatesByProduct.put(u.productId(), u);
        }

        for (OrderItem existingItem : order.getItems()) {
            ReviewOrderItemUpdateDto upd = updatesByProduct.remove(existingItem.getProduct().getId());
            if (upd != null) {
                int oldQty = existingItem.getQuantity();
                int newQty = Math.max(0, upd.quantity());
                int delta = newQty - oldQty;

                Product p = existingItem.getProduct();
                if (delta > 0 && delta > p.getAvailableStock()) {
                    throw new IllegalArgumentException("Estoque disponível insuficiente para aumentar " + p.getShortName() + " em +" + delta + " un.");
                }
                p.setReservedStock(Math.max(0, p.getReservedStock() + delta));
                productRepository.save(p);

                existingItem.setQuantity(newQty);
                existingItem.setUnitSalePrice(upd.unitSalePrice());
            }
        }

        // Se Gabriel adicionou na pré-nota algum dos 3 SKUs que estava zerado no pedido da rua:
        for (ReviewOrderItemUpdateDto newSkuUpd : updatesByProduct.values()) {
            if (newSkuUpd.quantity() != null && newSkuUpd.quantity() > 0) {
                Product p = productRepository.findById(newSkuUpd.productId())
                        .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado."));
                if (newSkuUpd.quantity() > p.getAvailableStock()) {
                    throw new IllegalArgumentException("Estoque insuficiente para " + p.getShortName());
                }
                p.setReservedStock(p.getReservedStock() + newSkuUpd.quantity());
                productRepository.save(p);

                OrderItem addedItem = new OrderItem();
                addedItem.setProduct(p);
                addedItem.setOrderedQuantity(0);
                addedItem.setQuantity(newSkuUpd.quantity());
                addedItem.setOrderedUnitPrice(newSkuUpd.unitSalePrice());
                addedItem.setUnitSalePrice(newSkuUpd.unitSalePrice());
                addedItem.setUnitCostSnapshot(p.getCurrentLandedCost());
                addedItem.setPromotionalPrice(false);
                order.addItem(addedItem);
            }
        }

        recalculateOrderFinancialSnapshots(order);
        Order saved = orderRepository.save(order);
        return fieldSalesService.toBackofficeOrderDto(saved);
    }

    /**
     * Gera o Romaneio de Separação e Entrega (sem preços/margens) e avança o pedido para EM_SEPARACAO.
     */
    @Transactional
    public RomaneioDto generateRomaneioAndMoveToPicking(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        if (order.getStatus() == OrderStatus.AGUARDANDO_REVISAO) {
            order.setStatus(OrderStatus.EM_SEPARACAO);
            orderRepository.save(order);
        }

        Client c = order.getClient();
        String fullAddress = String.format("%s, %s - %s, %s/%s (CEP: %s)",
                c.getStreet() != null ? c.getStreet() : "A confirmar",
                c.getNumber() != null ? c.getNumber() : "S/N",
                c.getNeighborhood() != null ? c.getNeighborhood() : "",
                c.getCity() != null ? c.getCity() : "São Paulo",
                c.getState() != null ? c.getState() : "SP",
                c.getZipCode() != null ? c.getZipCode() : "-");

        List<Map<String, Object>> blindItems = new ArrayList<>();
        int totalSacks = 0;
        StringBuilder itemsText = new StringBuilder();

        for (OrderItem item : order.getItems()) {
            if (item.getQuantity() == null || item.getQuantity() <= 0) continue;
            int qty = item.getQuantity();
            int weightKg = qty * 25;
            totalSacks += qty;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("skuCode", item.getProduct().getSkuCode());
            row.put("productName", item.getProduct().getName());
            row.put("unitOfMeasure", item.getProduct().getUnitOfMeasure());
            row.put("quantity", qty);
            row.put("weightKg", weightKg);
            blindItems.add(row);

            itemsText.append("• *").append(qty).append(" ").append(item.getProduct().getUnitOfMeasure())
                    .append("* — ").append(item.getProduct().getName()).append(" (").append(weightKg).append(" kg)\n");
        }

        int totalWeightKg = totalSacks * 25;
        String nfeBadge = order.getInvoiceData() != null && order.getInvoiceData().getNfeNumber() != null
                ? "NF-e #" + order.getInvoiceData().getNfeNumber()
                : "Pedido #" + order.getId();

        String whatsappText = "🚚 *ROMANEIO DE SEPARAÇÃO & ENTREGA — TOTAL TRIGO*\n" +
                "📋 *" + nfeBadge + "* | Previsão: *" + (order.getDeliveryForecast() != null ? order.getDeliveryForecast() : "Imediata") + "*\n\n" +
                "🏢 *Cliente:* " + (c.getTradeName() != null ? c.getTradeName() : c.getCorporateName()) + "\n" +
                "👤 *Contato:* " + (c.getContactName() != null ? c.getContactName() : "Comprador") +
                (c.getPhone() != null ? " (" + c.getPhone() + ")" : "") + "\n" +
                "📍 *Endereço:* " + fullAddress + "\n\n" +
                "📦 *CARGA PARA SEPARAR NO GALPÃO:*\n" +
                itemsText +
                "\n⚖️ *Total Volume:* " + totalSacks + " sacos (" + totalWeightKg + " kg)\n" +
                (order.getNotesForInvoiceOrDriver() != null && !order.getNotesForInvoiceOrDriver().isBlank()
                        ? "⚠️ *Obs Motorista/Entrega:* " + order.getNotesForInvoiceOrDriver()
                        : "");

        return new RomaneioDto(
                order.getId(),
                order.getStatus().name(),
                c.getCorporateName(),
                c.getContactName(),
                c.getPhone(),
                fullAddress,
                c.getNeighborhood(),
                order.getDeliveryForecast(),
                order.getNotesForInvoiceOrDriver(),
                totalSacks,
                totalWeightKg,
                whatsappText,
                blindItems
        );
    }

    /**
     * Emite a NF-e via NfeGatewayPort (Focus NFe / Nuvem Fiscal Adapter):
     * - Valida prontidão fiscal do cliente
     * - Muda status para FATURADO
     * - Realiza baixa definitiva no estoque_fisico e libera o estoque_reservado
     */
    @Transactional
    public BackofficeOrderDto issueNfe(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        if (order.getStatus() == OrderStatus.FATURADO || order.getStatus() == OrderStatus.ENTREGUE) {
            throw new IllegalStateException("Este pedido já foi faturado (NF-e #" + order.getInvoiceData().getNfeNumber() + ").");
        }
        if (order.getStatus() == OrderStatus.CANCELADO) {
            throw new IllegalStateException("Não é possível faturar um pedido cancelado.");
        }

        Client client = order.getClient();
        if (!client.isRegistrationComplete()) {
            throw new IllegalStateException(
                    "Prontidão Fiscal Pendente: complete o CNPJ e Código IBGE do cliente (botão 'Buscar CNPJ na BrasilAPI') antes de emitir a NF-e."
            );
        }

        NfeEmissionResult emissionResult = nfeGatewayPort.emitNfe(order);
        InvoiceData inv = order.getInvoiceData();

        if (!emissionResult.authorized()) {
            inv.setNfeStatus(NfeStatus.REJEITADA);
            inv.setSefazRejectionMessage(emissionResult.statusMessage());
            orderRepository.save(order);
            throw new IllegalStateException(emissionResult.statusMessage());
        }

        // Baixa definitiva no physicalStock e liberação do reservedStock
        for (OrderItem item : order.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 0;
            if (qty <= 0) continue;
            Product p = item.getProduct();
            p.setReservedStock(Math.max(0, p.getReservedStock() - qty));
            p.setPhysicalStock(Math.max(0, p.getPhysicalStock() - qty));
            productRepository.save(p);
        }

        order.setStatus(OrderStatus.FATURADO);
        inv.setNfeStatus(NfeStatus.AUTORIZADA);
        inv.setNfeNumber(emissionResult.nfeNumber());
        inv.setNfeAccessKey(emissionResult.accessKey());
        inv.setDanfePdfUrl("/api/backoffice/orders/" + order.getId() + "/danfe");
        inv.setXmlUrl("/api/backoffice/orders/" + order.getId() + "/xml");
        inv.setSefazRejectionMessage(null);

        if (emissionResult.xmlContent() != null) {
            emittedXmlStore.put(order.getId(), emissionResult.xmlContent());
        }

        Order saved = orderRepository.save(order);
        return fieldSalesService.toBackofficeOrderDto(saved);
    }

    @Transactional
    public BackofficeOrderDto markOrderDelivered(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        if (order.getStatus() != OrderStatus.FATURADO) {
            throw new IllegalStateException("Apenas pedidos FATURADOS podem avançar para ENTREGUE.");
        }
        order.setStatus(OrderStatus.ENTREGUE);
        return fieldSalesService.toBackofficeOrderDto(orderRepository.save(order));
    }

    @Transactional
    public BackofficeOrderDto cancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        if (order.getStatus() == OrderStatus.CANCELADO) {
            return fieldSalesService.toBackofficeOrderDto(order);
        }

        for (OrderItem item : order.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 0;
            if (qty <= 0) continue;
            Product p = item.getProduct();
            if (order.getStatus() == OrderStatus.AGUARDANDO_REVISAO || order.getStatus() == OrderStatus.EM_SEPARACAO) {
                // Estorna a reserva de volta para o disponível
                p.setReservedStock(Math.max(0, p.getReservedStock() - qty));
            } else if (order.getStatus() == OrderStatus.FATURADO) {
                // Cancelamento fiscal: devolve ao estoque físico
                p.setPhysicalStock(p.getPhysicalStock() + qty);
            }
            productRepository.save(p);
        }

        order.setStatus(OrderStatus.CANCELADO);
        if (order.getInvoiceData() != null) {
            order.getInvoiceData().setNfeStatus(NfeStatus.CANCELADA);
        }
        return fieldSalesService.toBackofficeOrderDto(orderRepository.save(order));
    }

    public String getOrderXml(Long orderId) {
        if (emittedXmlStore.containsKey(orderId)) {
            return emittedXmlStore.get(orderId);
        }
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        return nfeGatewayPort.emitNfe(order).xmlContent();
    }

    /**
     * Tela 5: Calculadora de Landed Cost & Entrada de Lote de Importação.
     * Rateia custos de frete internacional, impostos (II, IPI, PIS, COFINS, ICMS) e despachante/armazenagem
     * proporcionalmente ao valor FOB de cada SKU, atualizando o physicalStock e o currentLandedCost.
     */
    @Transactional(readOnly = true)
    public List<ImportBatch> listImportBatches() {
        return importBatchRepository.findAllByOrderByArrivalDateDescIdDesc();
    }

    @Transactional
    public ImportBatch registerImportBatch(CreateImportBatchRequest req) {
        List<ImportBatchItemRequest> validItems = req.items().stream()
                .filter(i -> i.quantityImported() != null && i.quantityImported() > 0)
                .toList();
        if (validItems.isEmpty()) {
            throw new IllegalArgumentException("Informe a quantidade importada de pelo menos 1 produto do lote.");
        }

        BigDecimal exchangeRate = req.exchangeRateUsd();
        BigDecimal totalFobUsd = BigDecimal.ZERO;
        for (ImportBatchItemRequest item : validItems) {
            BigDecimal itemFobUsd = item.fobUnitUsd().multiply(new BigDecimal(item.quantityImported()));
            totalFobUsd = totalFobUsd.add(itemFobUsd);
        }

        BigDecimal totalFobBrl = totalFobUsd.multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalNationalizationCostsBrl = req.internationalFreightBrl()
                .add(req.importTaxesBrl())
                .add(req.customsExpensesBrl());
        BigDecimal totalLandedBrl = totalFobBrl.add(totalNationalizationCostsBrl).setScale(2, RoundingMode.HALF_UP);

        ImportBatch batch = new ImportBatch();
        batch.setBatchCode(req.batchCode().trim().toUpperCase());
        batch.setArrivalDate(req.arrivalDate() != null ? req.arrivalDate() : LocalDate.now());
        batch.setSupplierName(req.supplierName() != null ? req.supplierName() : "Moinho Exportador Mercosul");
        batch.setExchangeRateUsd(exchangeRate);
        batch.setFobTotalUsd(totalFobUsd.setScale(2, RoundingMode.HALF_UP));
        batch.setInternationalFreightBrl(req.internationalFreightBrl());
        batch.setImportTaxesBrl(req.importTaxesBrl());
        batch.setCustomsExpensesBrl(req.customsExpensesBrl());
        batch.setTotalLandedCostBrl(totalLandedBrl);
        batch.setNotes(req.notes());

        int totalQuantityAllSkus = validItems.stream().mapToInt(ImportBatchItemRequest::quantityImported).sum();

        for (ImportBatchItemRequest itemReq : validItems) {
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado: " + itemReq.productId()));

            BigDecimal qtyBd = new BigDecimal(itemReq.quantityImported());
            BigDecimal itemFobUsd = itemReq.fobUnitUsd().multiply(qtyBd);
            BigDecimal itemFobBrl = itemFobUsd.multiply(exchangeRate);

            // Rateio proporcional ao FOB (ou por quantidade se FOB for zero)
            BigDecimal shareRatio = totalFobUsd.compareTo(BigDecimal.ZERO) > 0
                    ? itemFobUsd.divide(totalFobUsd, 6, RoundingMode.HALF_UP)
                    : qtyBd.divide(new BigDecimal(totalQuantityAllSkus), 6, RoundingMode.HALF_UP);

            BigDecimal allocatedExtraBrl = totalNationalizationCostsBrl.multiply(shareRatio);
            BigDecimal itemTotalLandedBrl = itemFobBrl.add(allocatedExtraBrl);
            BigDecimal calculatedUnitCostBrl = itemTotalLandedBrl.divide(qtyBd, 2, RoundingMode.HALF_UP);

            ImportBatchItem batchItem = new ImportBatchItem();
            batchItem.setProduct(product);
            batchItem.setQuantityImported(itemReq.quantityImported());
            batchItem.setFobUnitUsd(itemReq.fobUnitUsd());
            batchItem.setCalculatedUnitCostBrl(calculatedUnitCostBrl);
            batch.addItem(batchItem);

            // Atualiza Estoque Físico e Custo Internalizado Atual (currentLandedCost)
            product.setPhysicalStock(product.getPhysicalStock() + itemReq.quantityImported());
            product.setCurrentLandedCost(calculatedUnitCostBrl);
            productRepository.save(product);
        }

        return importBatchRepository.save(batch);
    }

    private void recalculateOrderFinancialSnapshots(Order order) {
        BigDecimal grossTotal = BigDecimal.ZERO;
        BigDecimal totalCmv = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        for (OrderItem item : order.getItems()) {
            if (item.getQuantity() == null || item.getQuantity() <= 0) continue;
            BigDecimal qtyBd = new BigDecimal(item.getQuantity());
            BigDecimal itemGross = item.getUnitSalePrice().multiply(qtyBd);
            BigDecimal itemCmv = item.getUnitCostSnapshot().multiply(qtyBd);
            BigDecimal taxRate = item.getProduct().getEstimatedTaxRate()
                    .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            BigDecimal itemTax = itemGross.multiply(taxRate);

            grossTotal = grossTotal.add(itemGross);
            totalCmv = totalCmv.add(itemCmv);
            totalTax = totalTax.add(itemTax);
        }

        BigDecimal shipping = order.getShippingCostEstimate() != null ? order.getShippingCostEstimate() : BigDecimal.ZERO;
        BigDecimal netProfit = grossTotal.subtract(totalCmv).subtract(totalTax).subtract(shipping);
        BigDecimal marginPct = grossTotal.compareTo(BigDecimal.ZERO) > 0
                ? netProfit.multiply(new BigDecimal("100")).divide(grossTotal, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        order.setGrossTotal(grossTotal.setScale(2, RoundingMode.HALF_UP));
        order.setTotalCmvSnapshot(totalCmv.setScale(2, RoundingMode.HALF_UP));
        order.setEstimatedTaxSnapshot(totalTax.setScale(2, RoundingMode.HALF_UP));
        order.setNetProfitSnapshot(netProfit.setScale(2, RoundingMode.HALF_UP));
        order.setNetMarginPercentage(marginPct);
    }
}
