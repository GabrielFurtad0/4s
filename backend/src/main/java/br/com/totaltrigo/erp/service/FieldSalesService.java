package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.enums.*;
import br.com.totaltrigo.erp.domain.model.*;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FieldSalesService {

    private final ProductRepository productRepository;
    private final ClientRepository clientRepository;
    private final ClientSkuPriceRepository clientSkuPriceRepository;
    private final ClientNoteRepository clientNoteRepository;
    private final VisitScheduleRepository visitScheduleRepository;
    private final OrderRepository orderRepository;

    public FieldSalesService(
            ProductRepository productRepository,
            ClientRepository clientRepository,
            ClientSkuPriceRepository clientSkuPriceRepository,
            ClientNoteRepository clientNoteRepository,
            VisitScheduleRepository visitScheduleRepository,
            OrderRepository orderRepository
    ) {
        this.productRepository = productRepository;
        this.clientRepository = clientRepository;
        this.clientSkuPriceRepository = clientSkuPriceRepository;
        this.clientNoteRepository = clientNoteRepository;
        this.visitScheduleRepository = visitScheduleRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTopbarSummary() {
        List<ProductStockDto> products = productRepository.findAllByOrderByIdAsc()
                .stream()
                .map(this::toProductDto)
                .toList();
        long pendingReviewCount = orderRepository.countByStatus(OrderStatus.AGUARDANDO_REVISAO)
                + orderRepository.countByStatus(OrderStatus.EM_SEPARACAO);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("products", products);
        result.put("pendingNfeQueueCount", pendingReviewCount);
        return result;
    }

    @Transactional(readOnly = true)
    public List<AgendaCardDto> getAgendaAndRadar() {
        List<Client> allClients = clientRepository.findAllByOrderByCorporateNameAsc();
        List<VisitSchedule> todayVisits = visitScheduleRepository.findByScheduledDateOrderByScheduledTimeAsc(LocalDate.now());
        Map<Long, VisitSchedule> visitByClientId = new HashMap<>();
        for (VisitSchedule v : todayVisits) {
            visitByClientId.putIfAbsent(v.getClient().getId(), v);
        }

        List<AgendaCardDto> cards = new ArrayList<>();
        for (Client c : allClients) {
            VisitSchedule visit = visitByClientId.get(c.getId());
            long daysSinceLast = c.getLastPurchaseDate() != null
                    ? Math.max(0, ChronoUnit.DAYS.between(c.getLastPurchaseDate(), LocalDate.now()))
                    : 0;
            int cycle = c.getAveragePurchaseCycleDays() != null ? c.getAveragePurchaseCycleDays() : 20;
            boolean needsRestock = c.getLastPurchaseDate() != null && daysSinceLast >= cycle;

            List<ClientNote> notes = clientNoteRepository.findByClientIdOrderByCreatedAtDesc(c.getId());
            String latestNote = !notes.isEmpty()
                    ? notes.get(0).getContent()
                    : (visit != null && visit.getReminderNote() != null ? visit.getReminderNote() : "Sem observações recentes");

            cards.add(new AgendaCardDto(
                    c.getId(),
                    visit != null ? visit.getId() : null,
                    c.getCorporateName(),
                    c.getTradeName() != null && !c.getTradeName().isBlank() ? c.getTradeName() : c.getCorporateName(),
                    c.getCnpj(),
                    c.getNeighborhood() != null ? c.getNeighborhood() : "São Paulo",
                    c.getCity() != null ? c.getCity() : "São Paulo",
                    c.getState() != null ? c.getState() : "SP",
                    visit != null ? visit.getScheduledTime() : null,
                    visit != null ? visit.getStatus().name() : null,
                    visit != null ? visit.getReminderNote() : null,
                    daysSinceLast,
                    cycle,
                    needsRestock,
                    c.getLastOrderTotal() != null ? c.getLastOrderTotal() : BigDecimal.ZERO,
                    c.getFinancialStatus(),
                    c.isRegistrationComplete(),
                    latestNote
            ));
        }

        cards.sort(Comparator.comparing((AgendaCardDto a) -> a.scheduledTime() == null ? "99:99" : a.scheduledTime())
                .thenComparing(Comparator.comparingLong(AgendaCardDto::daysSinceLastOrder).reversed()));
        return cards;
    }

    @Transactional(readOnly = true)
    public Client360Dto getClient360(Long clientId) {
        Client c = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado: " + clientId));

        List<Product> products = productRepository.findAllByOrderByIdAsc();
        Map<Long, ClientSkuPrice> priceMap = clientSkuPriceRepository.findByClientIdOrderByProductIdAsc(clientId)
                .stream()
                .collect(Collectors.toMap(p -> p.getProduct().getId(), p -> p, (a, b) -> a));

        List<SkuPriceMemoryDto> skuPrices = new ArrayList<>();
        for (Product p : products) {
            ClientSkuPrice mem = priceMap.get(p.getId());
            BigDecimal lastPracticed = mem != null ? mem.getLastPracticedPrice() : p.getBaseListPrice();
            BigDecimal agreedStandard = mem != null ? mem.getAgreedStandardPrice() : p.getBaseListPrice();
            LocalDate lastDate = mem != null ? mem.getLastOrderDate() : c.getLastPurchaseDate();

            skuPrices.add(new SkuPriceMemoryDto(
                    p.getId(),
                    p.getSkuCode(),
                    p.getName(),
                    p.getShortName(),
                    lastPracticed,
                    agreedStandard,
                    p.getBaseListPrice(),
                    p.getCurrentLandedCost(),
                    p.getAvailableStock(),
                    lastDate
            ));
        }

        List<ClientNoteDto> notes = clientNoteRepository.findByClientIdOrderByCreatedAtDesc(clientId)
                .stream()
                .map(n -> new ClientNoteDto(
                        n.getId(),
                        formatRelativeDate(n.getCreatedAt()),
                        n.getCreatedAt(),
                        n.getContent()
                ))
                .toList();

        List<OrderHistorySummaryDto> recentOrders = orderRepository.findByClientIdOrderByCreatedAtDesc(clientId)
                .stream()
                .limit(6)
                .map(o -> {
                    String itemsSummary = o.getItems().stream()
                            .filter(i -> i.getQuantity() != null && i.getQuantity() > 0)
                            .map(i -> i.getQuantity() + "x " + i.getProduct().getShortName())
                            .collect(Collectors.joining(", "));
                    String nfMeta = o.getInvoiceData() != null && o.getInvoiceData().getNfeNumber() != null
                            ? "NF-e #" + o.getInvoiceData().getNfeNumber()
                            : o.getStatus().name();
                    String metaInfo = formatRelativeDate(o.getCreatedAt()) + " • " + nfMeta;
                    return new OrderHistorySummaryDto(
                            o.getId(),
                            itemsSummary,
                            metaInfo,
                            o.getStatus(),
                            o.getInvoiceData() != null ? o.getInvoiceData().getNfeNumber() : null,
                            o.getGrossTotal(),
                            o.getCreatedAt()
                    );
                })
                .toList();

        long daysSinceLast = c.getLastPurchaseDate() != null
                ? Math.max(0, ChronoUnit.DAYS.between(c.getLastPurchaseDate(), LocalDate.now()))
                : 0;

        String fullAddress = String.format("%s, %s - %s, %s/%s",
                c.getStreet() != null ? c.getStreet() : "Endereço pendente",
                c.getNumber() != null ? c.getNumber() : "S/N",
                c.getNeighborhood() != null ? c.getNeighborhood() : "Centro",
                c.getCity() != null ? c.getCity() : "São Paulo",
                c.getState() != null ? c.getState() : "SP");

        return new Client360Dto(
                c.getId(),
                c.getCorporateName(),
                c.getTradeName() != null ? c.getTradeName() : c.getCorporateName(),
                c.getCnpj(),
                c.getStateRegistration(),
                c.getIeIndicator(),
                c.getPurchaseProfile(),
                c.getZipCode(),
                c.getStreet(),
                c.getNumber(),
                c.getComplement(),
                c.getNeighborhood(),
                c.getCity(),
                c.getState(),
                c.getIbgeCityCode(),
                fullAddress,
                c.getContactName() != null ? c.getContactName() : "Comprador",
                c.getPhone(),
                c.getDefaultPaymentTerms(),
                c.getAveragePurchaseCycleDays(),
                c.getLastPurchaseDate(),
                daysSinceLast,
                c.getLastOrderTotal() != null ? c.getLastOrderTotal() : BigDecimal.ZERO,
                c.getFinancialStatus(),
                c.isRegistrationComplete(),
                skuPrices,
                notes,
                recentOrders
        );
    }

    @Transactional
    public AgendaCardDto scheduleVisitOrQuickClient(CreateVisitRequest req) {
        Client client;
        if (req.clientId() != null) {
            client = clientRepository.findById(req.clientId())
                    .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
        } else {
            if (req.quickClientName() == null || req.quickClientName().isBlank()) {
                throw new IllegalArgumentException("Informe o nome do cliente para agendar a visita.");
            }
            client = new Client();
            client.setCorporateName(req.quickClientName().trim().toUpperCase());
            client.setTradeName(req.quickClientName().trim());
            client.setCnpj(req.quickCnpj() != null && !req.quickCnpj().isBlank() ? req.quickCnpj().trim() : null);
            client.setNeighborhood(req.quickNeighborhood() != null && !req.quickNeighborhood().isBlank() ? req.quickNeighborhood().trim() : "Zona Sul SP");
            client.setContactName(req.quickContactName() != null && !req.quickContactName().isBlank() ? req.quickContactName().trim() : "Comprador");
            client.setPhone(req.quickPhone());
            client.setDefaultPaymentTerms("Boleto 28 dias");
            client.setAveragePurchaseCycleDays(20);
            client.setFinancialStatus(FinancialStatus.EM_DIA);
            client.setRegistrationComplete(false); // Cadastrado rápido na rua pelo pai!
            client = clientRepository.save(client);

            for (Product p : productRepository.findAllByOrderByIdAsc()) {
                ClientSkuPrice csp = new ClientSkuPrice();
                csp.setClient(client);
                csp.setProduct(p);
                csp.setLastPracticedPrice(p.getBaseListPrice());
                csp.setAgreedStandardPrice(p.getBaseListPrice());
                clientSkuPriceRepository.save(csp);
            }
        }

        VisitSchedule visit = new VisitSchedule();
        visit.setClient(client);
        visit.setScheduledDate(LocalDate.now());
        visit.setScheduledTime(req.scheduledTime());
        visit.setReminderNote(req.reminderNote());
        visit.setStatus(VisitStatus.PENDENTE);
        visitScheduleRepository.save(visit);

        if (req.reminderNote() != null && !req.reminderNote().isBlank()) {
            ClientNote note = new ClientNote();
            note.setClient(client);
            note.setCreatedAt(LocalDateTime.now());
            note.setContent(req.reminderNote().trim());
            clientNoteRepository.save(note);
        }

        final Long targetClientId = client.getId();
        return getAgendaAndRadar().stream()
                .filter(a -> a.clientId().equals(targetClientId))
                .findFirst()
                .orElseThrow();
    }

    @Transactional
    public ClientNoteDto addClientNote(Long clientId, AddNoteRequest req) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
        ClientNote note = new ClientNote();
        note.setClient(client);
        note.setCreatedAt(LocalDateTime.now());
        note.setContent(req.content().trim());
        note = clientNoteRepository.save(note);

        return new ClientNoteDto(note.getId(), "Agora", note.getCreatedAt(), note.getContent());
    }

    /**
     * Fecha o pedido na rua e envia para a Mesa de Conferência (AGUARDANDO_REVISAO),
     * reservando o estoque imediatamente e congelando o snapshot financeiro de custos e lucro.
     */
    @Transactional
    public BackofficeOrderDto createOrderFromStreet(CreateOrderRequest req) {
        Client client = clientRepository.findById(req.clientId())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));

        List<OrderItemRequest> activeItems = req.items().stream()
                .filter(i -> i.quantity() != null && i.quantity() > 0)
                .toList();

        if (activeItems.isEmpty()) {
            throw new IllegalArgumentException("Adicione pelo menos 1 saco nos produtos para fechar o pedido.");
        }

        Order order = new Order();
        order.setClient(client);
        order.setCreatedAt(LocalDateTime.now());
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);
        order.setPaymentTerms(req.paymentTerms());
        order.setDeliveryForecast(req.deliveryForecast() != null ? req.deliveryForecast() : "Amanhã (Manhã)");
        order.setNotesForInvoiceOrDriver(req.notesForInvoiceOrDriver());
        BigDecimal shipping = req.shippingCostEstimate() != null ? req.shippingCostEstimate() : new BigDecimal("45.00");
        order.setShippingCostEstimate(shipping);

        BigDecimal grossTotal = BigDecimal.ZERO;
        BigDecimal totalCmv = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        for (OrderItemRequest itemReq : activeItems) {
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado: " + itemReq.productId()));

            if (itemReq.quantity() > product.getAvailableStock()) {
                throw new IllegalArgumentException(String.format(
                        "Estoque disponível insuficiente para %s! Solicitado: %d %s, Disponível: %d %s.",
                        product.getShortName(), itemReq.quantity(), product.getUnitOfMeasure(),
                        product.getAvailableStock(), product.getUnitOfMeasure()
                ));
            }

            // Reserva imediata de estoque (aumenta reservedStock, reduz availableStock)
            product.setReservedStock(product.getReservedStock() + itemReq.quantity());
            productRepository.save(product);

            OrderItem item = new OrderItem();
            item.setProduct(product);
            item.setOrderedQuantity(itemReq.quantity());
            item.setQuantity(itemReq.quantity());
            item.setOrderedUnitPrice(itemReq.unitSalePrice());
            item.setUnitSalePrice(itemReq.unitSalePrice());
            item.setUnitCostSnapshot(product.getCurrentLandedCost());
            item.setPromotionalPrice(itemReq.isPromotionalPrice());
            order.addItem(item);

            BigDecimal qtyBd = new BigDecimal(itemReq.quantity());
            BigDecimal itemGross = itemReq.unitSalePrice().multiply(qtyBd);
            BigDecimal itemCmv = product.getCurrentLandedCost().multiply(qtyBd);
            BigDecimal taxRate = product.getEstimatedTaxRate().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            BigDecimal itemTax = itemGross.multiply(taxRate);

            grossTotal = grossTotal.add(itemGross);
            totalCmv = totalCmv.add(itemCmv);
            totalTax = totalTax.add(itemTax);

            // Atualiza memória de preço do cliente
            ClientSkuPrice priceMem = clientSkuPriceRepository
                    .findByClientIdAndProductId(client.getId(), product.getId())
                    .orElseGet(() -> {
                        ClientSkuPrice n = new ClientSkuPrice();
                        n.setClient(client);
                        n.setProduct(product);
                        n.setAgreedStandardPrice(itemReq.unitSalePrice());
                        return n;
                    });
            priceMem.setLastPracticedPrice(itemReq.unitSalePrice());
            priceMem.setLastOrderDate(LocalDate.now());
            // Se NÃO for preço promocional único, atualiza o preço padrão acordado
            if (!itemReq.isPromotionalPrice()) {
                priceMem.setAgreedStandardPrice(itemReq.unitSalePrice());
            }
            clientSkuPriceRepository.save(priceMem);
        }

        BigDecimal netProfit = grossTotal.subtract(totalCmv).subtract(totalTax).subtract(shipping);
        BigDecimal marginPct = grossTotal.compareTo(BigDecimal.ZERO) > 0
                ? netProfit.multiply(new BigDecimal("100")).divide(grossTotal, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        order.setOriginalCommercialTotal(grossTotal.setScale(2, RoundingMode.HALF_UP));
        order.setGrossTotal(grossTotal.setScale(2, RoundingMode.HALF_UP));
        order.setTotalCmvSnapshot(totalCmv.setScale(2, RoundingMode.HALF_UP));
        order.setEstimatedTaxSnapshot(totalTax.setScale(2, RoundingMode.HALF_UP));
        order.setNetProfitSnapshot(netProfit.setScale(2, RoundingMode.HALF_UP));
        order.setNetMarginPercentage(marginPct);

        InvoiceData inv = new InvoiceData();
        inv.setNfeStatus(NfeStatus.PENDENTE);
        order.setInvoiceData(inv);

        Order saved = orderRepository.save(order);

        client.setLastPurchaseDate(LocalDate.now());
        client.setLastOrderTotal(saved.getGrossTotal());
        clientRepository.save(client);

        return toBackofficeOrderDto(saved);
    }

    public ProductStockDto toProductDto(Product p) {
        return new ProductStockDto(
                p.getId(),
                p.getSkuCode(),
                p.getErpCode(),
                p.getName(),
                p.getShortName(),
                p.getUnitOfMeasure(),
                p.getUnitsPerBox(),
                p.getPhysicalStock(),
                p.getReservedStock(),
                p.getAvailableStock(),
                p.getCurrentLandedCost(),
                p.getBaseListPrice(),
                p.getNcm(),
                p.getCest(),
                p.getcBenef(),
                p.getOriginCode(),
                p.getDefaultCfopInternal(),
                p.getDefaultCfopInterstate(),
                p.getEstimatedTaxRate()
        );
    }

    public BackofficeOrderDto toBackofficeOrderDto(Order o) {
        Client c = o.getClient();
        List<OrderItemDetailDto> itemDtos = o.getItems().stream()
                .map(i -> {
                    Product p = i.getProduct();
                    BigDecimal sub = i.getUnitSalePrice()
                            .multiply(new BigDecimal(i.getQuantity()))
                            .setScale(2, RoundingMode.HALF_UP);
                    boolean adjusted = !Objects.equals(i.getOrderedQuantity(), i.getQuantity())
                            || i.getOrderedUnitPrice().compareTo(i.getUnitSalePrice()) != 0;
                    String cfop = "SP".equalsIgnoreCase(c.getState()) ? p.getDefaultCfopInternal() : p.getDefaultCfopInterstate();
                    return new OrderItemDetailDto(
                            i.getId(),
                            p.getId(),
                            p.getSkuCode(),
                            p.getErpCode(),
                            p.getName(),
                            p.getShortName(),
                            p.getNcm(),
                            cfop,
                            i.getOrderedQuantity(),
                            i.getQuantity(),
                            i.getOrderedUnitPrice(),
                            i.getUnitSalePrice(),
                            i.getUnitCostSnapshot(),
                            sub,
                            i.isPromotionalPrice(),
                            adjusted,
                            p.getAvailableStock(),
                            p.getPhysicalStock()
                    );
                })
                .toList();

        boolean hasDiff = o.getOriginalCommercialTotal().compareTo(o.getGrossTotal()) != 0
                || itemDtos.stream().anyMatch(OrderItemDetailDto::hasBackofficeAdjustment);

        InvoiceData inv = o.getInvoiceData();

        return new BackofficeOrderDto(
                o.getId(),
                c.getId(),
                c.getCorporateName(),
                c.getTradeName() != null ? c.getTradeName() : c.getCorporateName(),
                c.getCnpj(),
                c.getStateRegistration(),
                c.getIeIndicator(),
                c.getPurchaseProfile(),
                c.getStreet(),
                c.getNumber(),
                c.getNeighborhood(),
                c.getCity(),
                c.getState(),
                c.getZipCode(),
                c.getIbgeCityCode(),
                c.isRegistrationComplete(),
                c.getFinancialStatus(),
                o.getCreatedAt(),
                o.getStatus(),
                o.getPaymentTerms(),
                o.getDeliveryForecast(),
                o.getNotesForInvoiceOrDriver(),
                o.getBackofficeAdjustmentNotes(),
                o.getShippingCostEstimate(),
                o.getOriginalCommercialTotal(),
                o.getGrossTotal(),
                o.getTotalCmvSnapshot(),
                o.getEstimatedTaxSnapshot(),
                o.getNetProfitSnapshot(),
                o.getNetMarginPercentage(),
                hasDiff,
                inv != null ? inv.getNfeStatus() : NfeStatus.PENDENTE,
                inv != null ? inv.getNfeNumber() : null,
                inv != null ? inv.getNfeAccessKey() : null,
                inv != null ? inv.getDanfePdfUrl() : null,
                inv != null ? inv.getXmlUrl() : null,
                inv != null ? inv.getSefazRejectionMessage() : null,
                itemDtos
        );
    }

    private String formatRelativeDate(LocalDateTime dt) {
        if (dt == null) return "Recente";
        long days = ChronoUnit.DAYS.between(dt.toLocalDate(), LocalDate.now());
        if (days <= 0) return "Hoje";
        if (days == 1) return "Ontem";
        return days + " dias atrás";
    }
}
