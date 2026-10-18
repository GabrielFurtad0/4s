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
    private final ManagementExtensionService managementExtensionService;

    private final Map<Long, String> emittedXmlStore = new ConcurrentHashMap<>();

    public BackofficeService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            ClientRepository clientRepository,
            ImportBatchRepository importBatchRepository,
            FieldSalesService fieldSalesService,
            NfeGatewayPort nfeGatewayPort,
            @org.springframework.context.annotation.Lazy ManagementExtensionService managementExtensionService
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.clientRepository = clientRepository;
        this.importBatchRepository = importBatchRepository;
        this.fieldSalesService = fieldSalesService;
        this.nfeGatewayPort = nfeGatewayPort;
        this.managementExtensionService = managementExtensionService;
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

        // 3. Ajusta Qtd. Expedição (DQ), Qtd. Base (BQ) e Preço Unitário na Pré-Nota
        Map<Long, ReviewOrderItemUpdateDto> updatesByProduct = new HashMap<>();
        for (ReviewOrderItemUpdateDto u : req.items()) {
            updatesByProduct.put(u.productId(), u);
        }

        for (OrderItem existingItem : order.getItems()) {
            ReviewOrderItemUpdateDto upd = updatesByProduct.remove(existingItem.getProduct().getId());
            if (upd != null) {
                int oldDq = existingItem.getDispatchQuantity() != null ? existingItem.getDispatchQuantity() : 0;
                int newDq = Math.max(0, upd.resolvedDispatchQuantity());
                int newBq = Math.max(0, upd.resolvedBaseQuantity());

                Product p = existingItem.getProduct();
                if (newBq > newDq) {
                    throw new IllegalArgumentException(
                            "A Qtd. Base (BQ = " + newBq + ") de " + p.getShortName() + " não pode ser maior que a Qtd. Expedição (DQ = " + newDq + ")."
                    );
                }

                int deltaDq = newDq - oldDq;
                if (deltaDq > 0 && deltaDq > p.getAvailableStock()) {
                    throw new IllegalArgumentException("Estoque disponível insuficiente para aumentar " + p.getShortName() + " em +" + deltaDq + " un.");
                }
                p.setReservedStock(Math.max(0, p.getReservedStock() + deltaDq));
                productRepository.save(p);

                existingItem.setDispatchQuantity(newDq);
                existingItem.setBaseQuantity(newBq);
                existingItem.setUnitSalePrice(upd.unitSalePrice());
            }
        }

        // Se Gabriel adicionou na pré-nota algum dos 3 SKUs que estava zerado no pedido da rua:
        for (ReviewOrderItemUpdateDto newSkuUpd : updatesByProduct.values()) {
            int newDq = Math.max(0, newSkuUpd.resolvedDispatchQuantity());
            int newBq = Math.max(0, newSkuUpd.resolvedBaseQuantity());
            if (newDq > 0) {
                Product p = productRepository.findById(newSkuUpd.productId())
                        .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado."));
                if (newBq > newDq) {
                    throw new IllegalArgumentException(
                            "A Qtd. Base (BQ = " + newBq + ") de " + p.getShortName() + " não pode ser maior que a Qtd. Expedição (DQ = " + newDq + ")."
                    );
                }
                if (newDq > p.getAvailableStock()) {
                    throw new IllegalArgumentException("Estoque insuficiente para " + p.getShortName());
                }
                p.setReservedStock(p.getReservedStock() + newDq);
                productRepository.save(p);

                OrderItem addedItem = new OrderItem();
                addedItem.setProduct(p);
                addedItem.setOrderedQuantity(0);
                addedItem.setDispatchQuantity(newDq);
                addedItem.setBaseQuantity(newBq);
                addedItem.setOrderedUnitPrice(newSkuUpd.unitSalePrice());
                addedItem.setUnitSalePrice(newSkuUpd.unitSalePrice());
                addedItem.setUnitCostSnapshot(p.getCurrentLandedCost());
                addedItem.setPromotionalPrice(false);
                order.addItem(addedItem);
            }
        }

        int totalDq = order.getItems().stream().mapToInt(i -> i.getDispatchQuantity() != null ? i.getDispatchQuantity() : 0).sum();
        int totalBq = order.getItems().stream().mapToInt(i -> i.getBaseQuantity() != null ? i.getBaseQuantity() : 0).sum();
        if (totalDq < 1) {
            throw new IllegalArgumentException("A Qtd. Expedição (DQ) total do pedido deve ser de pelo menos 1 saca.");
        }
        if (totalBq < 1) {
            throw new IllegalArgumentException("A Qtd. Base (BQ) total do pedido nunca pode ser zero (mínimo 1 saca).");
        }

        recalculateOrderFinancialSnapshots(order);
        Order saved = orderRepository.save(order);
        if (managementExtensionService != null) {
            managementExtensionService.logAudit(
                    "Gabriel Furtado",
                    "Backoffice & Fiscal",
                    "REVISAO_PRE_NOTA",
                    "Order",
                    String.valueOf(orderId),
                    "Pré-nota do Pedido #" + orderId + " revisada com recálculo de DQ/BQ e dados cadastrais."
            );
        }
        return fieldSalesService.toBackofficeOrderDto(saved);
    }

    /**
     * Gera o Romaneio Cego de Separação e Entrega (baseado exclusivamente na Qtd. Expedição — DQ)
     * e avança o pedido para EM_SEPARACAO.
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
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            if (dq <= 0) continue;
            int weightKg = dq * 25;
            totalSacks += dq;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("skuCode", item.getProduct().getSkuCode());
            row.put("productName", item.getProduct().getName());
            row.put("unitOfMeasure", item.getProduct().getUnitOfMeasure());
            row.put("dispatchQuantity", dq);
            row.put("quantity", dq);
            row.put("weightKg", weightKg);
            blindItems.add(row);

            itemsText.append("• *").append(dq).append(" ").append(item.getProduct().getUnitOfMeasure())
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
                "📦 *CARGA PARA SEPARAR NO GALPÃO (DQ):*\n" +
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
     * - Valida prontidão fiscal do cliente e soma(BQ) >= 1
     * - Muda status para FATURADO
     * - Baixa DQ no physicalStock/reservedStock e baixa BQ no baseStock
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

        int totalBq = order.getItems().stream()
                .mapToInt(i -> i.getBaseQuantity() != null ? i.getBaseQuantity() : 0)
                .sum();
        if (totalBq < 1) {
            throw new IllegalStateException("A Qtd. Base (BQ) total do pedido nunca pode ser zero (mínimo 1 saca).");
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

        // Baixa definitiva de DQ no physicalStock/reservedStock e de BQ no baseStock
        for (OrderItem item : order.getItems()) {
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            int bq = item.getBaseQuantity() != null ? item.getBaseQuantity() : 0;
            if (dq <= 0 && bq <= 0) continue;
            Product p = item.getProduct();
            if (dq > 0) {
                p.setReservedStock(Math.max(0, p.getReservedStock() - dq));
                p.setPhysicalStock(Math.max(0, p.getPhysicalStock() - dq));
            }
            if (bq > 0) {
                p.setBaseStock(Math.max(0, p.getBaseStock() - bq));
            }
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

        if (managementExtensionService != null) {
            managementExtensionService.generateTitlesForOrder(saved, "Gabriel Furtado", "Backoffice & Fiscal");
            managementExtensionService.logAudit(
                    "Gabriel Furtado",
                    "Backoffice & Fiscal",
                    "EMISSAO_NFE",
                    "Order",
                    String.valueOf(saved.getId()),
                    "NF-e #" + emissionResult.nfeNumber() + " emitida para " + client.getCorporateName() +
                            " (Chave: " + emissionResult.accessKey() + "). Boletos bancários sobre BQ gerados automaticamente."
            );
        }

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
        Order saved = orderRepository.save(order);
        if (managementExtensionService != null) {
            managementExtensionService.logAudit(
                    "Expedição",
                    "Romaneio Cego",
                    "ENTREGA_CONCLUIDA",
                    "Order",
                    String.valueOf(orderId),
                    "Pedido #" + orderId + " marcado como entregue ao cliente."
            );
        }
        return fieldSalesService.toBackofficeOrderDto(saved);
    }

    @Transactional
    public BackofficeOrderDto cancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        if (order.getStatus() == OrderStatus.CANCELADO) {
            return fieldSalesService.toBackofficeOrderDto(order);
        }

        for (OrderItem item : order.getItems()) {
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            int bq = item.getBaseQuantity() != null ? item.getBaseQuantity() : 0;
            if (dq <= 0 && bq <= 0) continue;
            Product p = item.getProduct();
            if (order.getStatus() == OrderStatus.AGUARDANDO_REVISAO || order.getStatus() == OrderStatus.EM_SEPARACAO) {
                // Estorna a reserva de DQ de volta para o disponível físico
                p.setReservedStock(Math.max(0, p.getReservedStock() - dq));
            } else if (order.getStatus() == OrderStatus.FATURADO) {
                // Cancelamento de nota faturada: devolve DQ ao estoque físico e BQ ao saldo base
                p.setPhysicalStock(p.getPhysicalStock() + dq);
                p.setBaseStock(p.getBaseStock() + bq);
            }
            productRepository.save(p);
        }

        order.setStatus(OrderStatus.CANCELADO);
        if (order.getInvoiceData() != null) {
            order.getInvoiceData().setNfeStatus(NfeStatus.CANCELADA);
        }
        Order saved = orderRepository.save(order);
        if (managementExtensionService != null) {
            managementExtensionService.cancelTitlesForOrder(order.getId(), "Gabriel Furtado", "Backoffice & Fiscal");
            managementExtensionService.logAudit(
                    "Gabriel Furtado",
                    "Backoffice & Fiscal",
                    "CANCELAMENTO_PEDIDO",
                    "Order",
                    String.valueOf(order.getId()),
                    "Pedido #" + order.getId() + " cancelado (estoque e boletos em aberto estornados)."
            );
        }
        return fieldSalesService.toBackofficeOrderDto(saved);
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
     * proporcionalmente ao valor FOB de cada SKU, somando a quantidade igualmente em physicalStock e baseStock (BQ = DQ)
     * e recalculando o Custo Médio Ponderado de cada produto.
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

            int qtyImported = itemReq.quantityImported();
            BigDecimal qtyBd = new BigDecimal(qtyImported);
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
            batchItem.setQuantityImported(qtyImported);
            batchItem.setFobUnitUsd(itemReq.fobUnitUsd());
            batchItem.setCalculatedUnitCostBrl(calculatedUnitCostBrl);
            batch.addItem(batchItem);

            // Custo Médio Ponderado entre estoque físico atual e novo lote importado
            int currentPhysical = product.getPhysicalStock() != null ? product.getPhysicalStock() : 0;
            int currentBase = product.getBaseStock() != null ? product.getBaseStock() : currentPhysical;
            BigDecimal currentCost = product.getCurrentLandedCost() != null ? product.getCurrentLandedCost() : calculatedUnitCostBrl;

            BigDecimal weightedAvgCost;
            if (currentPhysical > 0) {
                BigDecimal existingValue = currentCost.multiply(new BigDecimal(currentPhysical));
                BigDecimal newBatchValue = calculatedUnitCostBrl.multiply(qtyBd);
                weightedAvgCost = existingValue.add(newBatchValue)
                        .divide(new BigDecimal(currentPhysical + qtyImported), 2, RoundingMode.HALF_UP);
            } else {
                weightedAvgCost = calculatedUnitCostBrl;
            }

            // Na entrada de importação, BQ = DQ (soma igualmente em physicalStock e baseStock)
            product.setPhysicalStock(currentPhysical + qtyImported);
            product.setBaseStock(currentBase + qtyImported);
            product.setCurrentLandedCost(weightedAvgCost);
            productRepository.save(product);
        }

        ImportBatch savedBatch = importBatchRepository.save(batch);
        if (managementExtensionService != null) {
            managementExtensionService.logAudit(
                    "Gabriel Furtado",
                    "Backoffice & Fiscal",
                    "ENTRADA_LOTE_IMPORTACAO",
                    "ImportBatch",
                    String.valueOf(savedBatch.getId()),
                    "Nacionalização do Lote " + savedBatch.getBatchCode() + " (" + totalQuantityAllSkus + " sacas, Custo Total Landed R$ " + totalLandedBrl + ")"
            );
        }
        return savedBatch;
    }

    private void recalculateOrderFinancialSnapshots(Order order) {
        BigDecimal grossTotal = BigDecimal.ZERO;
        BigDecimal totalCmv = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        int totalDq = 0;

        for (OrderItem item : order.getItems()) {
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            int bq = item.getBaseQuantity() != null ? item.getBaseQuantity() : 0;
            if (dq <= 0 && bq <= 0) continue;

            totalDq += dq;
            BigDecimal dqBd = new BigDecimal(dq);
            BigDecimal bqBd = new BigDecimal(bq);
            BigDecimal itemGross = item.getUnitSalePrice().multiply(dqBd);
            BigDecimal itemCmv = item.getUnitCostSnapshot().multiply(dqBd);
            BigDecimal taxRate = item.getProduct().getEstimatedTaxRate()
                    .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            BigDecimal itemTax = item.getUnitSalePrice().multiply(bqBd).multiply(taxRate);

            grossTotal = grossTotal.add(itemGross);
            totalCmv = totalCmv.add(itemCmv);
            totalTax = totalTax.add(itemTax);
        }

        // Frete oficial: R$ 4,00 por saca entregue (DQ)
        BigDecimal shipping = new BigDecimal("4.00").multiply(new BigDecimal(totalDq)).setScale(2, RoundingMode.HALF_UP);
        order.setShippingCostEstimate(shipping);

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
