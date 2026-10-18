package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.adapter.NfeGatewayPort;
import br.com.totaltrigo.erp.adapter.NfeGatewayPort.NfeEmissionResult;
import br.com.totaltrigo.erp.domain.enums.FinancialStatus;
import br.com.totaltrigo.erp.domain.enums.IeIndicator;
import br.com.totaltrigo.erp.domain.enums.NfeStatus;
import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import br.com.totaltrigo.erp.domain.enums.PurchaseProfile;
import br.com.totaltrigo.erp.domain.model.*;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BackofficeServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientRepository clientRepository;

    @Mock
    private ImportBatchRepository importBatchRepository;

    @Mock
    private FieldSalesService fieldSalesService;

    @Mock
    private NfeGatewayPort nfeGatewayPort;

    @InjectMocks
    private BackofficeService backofficeService;

    private Client sampleClient;
    private Product sampleProduct;

    @BeforeEach
    void setUp() {
        sampleClient = new Client();
        sampleClient.setId(1L);
        sampleClient.setCorporateName("PANIFICADORA MODELO LTDA");
        sampleClient.setTradeName("Panificadora Modelo");
        sampleClient.setCnpj("09265201000195");
        sampleClient.setStateRegistration("149932895118");
        sampleClient.setIeIndicator(IeIndicator.CONTRIBUINTE);
        sampleClient.setPurchaseProfile(PurchaseProfile.INDUSTRIALIZACAO);
        sampleClient.setStreet("Avenida Paulista");
        sampleClient.setNumber("1000");
        sampleClient.setNeighborhood("Bela Vista");
        sampleClient.setCity("São Paulo");
        sampleClient.setState("SP");
        sampleClient.setZipCode("01310100");
        sampleClient.setIbgeCityCode("3550308");
        sampleClient.setRegistrationComplete(true);
        sampleClient.setFinancialStatus(FinancialStatus.EM_DIA);

        sampleProduct = new Product();
        sampleProduct.setId(10L);
        sampleProduct.setSkuCode("FAR-ESP-25");
        sampleProduct.setErpCode("0001");
        sampleProduct.setName("Farinha de Trigo Especial 25kg");
        sampleProduct.setShortName("Especial 25kg");
        sampleProduct.setUnitOfMeasure("SA");
        sampleProduct.setUnitsPerBox(1);
        sampleProduct.setPhysicalStock(100);
        sampleProduct.setReservedStock(20);
        sampleProduct.setBaseStock(90);
        sampleProduct.setCurrentLandedCost(new BigDecimal("70.00"));
        sampleProduct.setBaseListPrice(new BigDecimal("100.00"));
        sampleProduct.setNcm("11010010");
        sampleProduct.setDefaultCfopInternal("5102");
        sampleProduct.setDefaultCfopInterstate("6102");
        sampleProduct.setEstimatedTaxRate(new BigDecimal("8.00"));

        lenient().when(fieldSalesService.toBackofficeOrderDto(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            return new BackofficeOrderDto(
                    o.getId(),
                    o.getClient() != null ? o.getClient().getId() : null,
                    o.getClient() != null ? o.getClient().getCorporateName() : null,
                    o.getClient() != null ? o.getClient().getTradeName() : null,
                    o.getClient() != null ? o.getClient().getCnpj() : null,
                    o.getClient() != null ? o.getClient().getStateRegistration() : null,
                    o.getClient() != null ? o.getClient().getIeIndicator() : null,
                    o.getClient() != null ? o.getClient().getPurchaseProfile() : null,
                    o.getClient() != null ? o.getClient().getStreet() : null,
                    o.getClient() != null ? o.getClient().getNumber() : null,
                    o.getClient() != null ? o.getClient().getNeighborhood() : null,
                    o.getClient() != null ? o.getClient().getCity() : null,
                    o.getClient() != null ? o.getClient().getState() : null,
                    o.getClient() != null ? o.getClient().getZipCode() : null,
                    o.getClient() != null ? o.getClient().getIbgeCityCode() : null,
                    o.getClient() != null && o.getClient().isRegistrationComplete(),
                    o.getClient() != null ? o.getClient().getFinancialStatus() : null,
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
                    false,
                    o.getInvoiceData() != null ? o.getInvoiceData().getNfeStatus() : NfeStatus.PENDENTE,
                    o.getInvoiceData() != null ? o.getInvoiceData().getNfeNumber() : null,
                    o.getInvoiceData() != null ? o.getInvoiceData().getNfeAccessKey() : null,
                    o.getInvoiceData() != null ? o.getInvoiceData().getDanfePdfUrl() : null,
                    o.getInvoiceData() != null ? o.getInvoiceData().getXmlUrl() : null,
                    o.getInvoiceData() != null ? o.getInvoiceData().getSefazRejectionMessage() : null,
                    List.of()
            );
        });
    }

    // =========================================================================
    // 1. ENTRADA DE LOTE DE IMPORTAÇÃO (registerImportBatch)
    // =========================================================================

    @Test
    @DisplayName("Entrada de Lote: validação matemática do Custo Médio Ponderado e soma igual em physicalStock e baseStock")
    void shouldRegisterImportBatchAndCalculateWeightedAverageCostWhenStockExists() {
        // Cenário:
        // Produto já possui: physicalStock = 500, baseStock = 400, currentLandedCost = R$ 60,00
        sampleProduct.setPhysicalStock(500);
        sampleProduct.setBaseStock(400);
        sampleProduct.setCurrentLandedCost(new BigDecimal("60.00"));

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(importBatchRepository.save(any(ImportBatch.class))).thenAnswer(inv -> inv.getArgument(0));

        // Lote de Importação:
        // 1.000 sacas com FOB USD 10,00 cada. Câmbio USD = R$ 5,00 -> FOB BRL = 1000 * 10 * 5 = R$ 50.000,00
        // Frete Internacional: R$ 5.000,00
        // Impostos de Importação: R$ 10.000,00
        // Despesas Aduaneiras / Armazenagem: R$ 5.000,00
        // Total Custos Nacionalização = R$ 20.000,00
        // Total Landed BRL = R$ 50.000,00 + R$ 20.000,00 = R$ 70.000,00
        // Custo Unitário do Novo Lote = R$ 70.000,00 / 1.000 = R$ 70,00
        //
        // Custo Médio Ponderado:
        // ((estoqueAtual * custoAtual) + (qtdImportada * custoNovoLote)) / (estoqueAtual + qtdImportada)
        // = ((500 * 60.00) + (1000 * 70.00)) / (500 + 1000)
        // = (30.000 + 70.000) / 1500 = 100.000 / 1500 = R$ 66,67
        ImportBatchItemRequest itemReq = new ImportBatchItemRequest(
                10L,
                1000,
                new BigDecimal("10.00")
        );
        CreateImportBatchRequest req = new CreateImportBatchRequest(
                "LOTE-2026-IMP-01",
                LocalDate.now(),
                "Moinho Mercosul",
                new BigDecimal("5.00"),
                new BigDecimal("5000.00"),
                new BigDecimal("10000.00"),
                new BigDecimal("5000.00"),
                "Container descarregado no Porto de Santos",
                List.of(itemReq)
        );

        ImportBatch batch = backofficeService.registerImportBatch(req);

        assertNotNull(batch);
        assertEquals("LOTE-2026-IMP-01", batch.getBatchCode());
        assertEquals(new BigDecimal("70000.00"), batch.getTotalLandedCostBrl());

        // Verificação do produto atualizado:
        // 1. Custo Médio Ponderado = R$ 66,67
        assertEquals(new BigDecimal("66.67"), sampleProduct.getCurrentLandedCost());

        // 2. Na entrada de importação BQ = DQ: soma igualmente em physicalStock e baseStock!
        // physicalStock: 500 + 1000 = 1500
        assertEquals(1500, sampleProduct.getPhysicalStock());
        // baseStock: 400 + 1000 = 1400
        assertEquals(1400, sampleProduct.getBaseStock());

        verify(productRepository).save(sampleProduct);
        verify(importBatchRepository).save(any(ImportBatch.class));
    }

    @Test
    @DisplayName("Entrada de Lote quando estoque físico inicial for zero: custo médio ponderado iguala o custo do novo lote")
    void shouldRegisterImportBatchWhenCurrentPhysicalStockIsZero() {
        sampleProduct.setPhysicalStock(0);
        sampleProduct.setBaseStock(0);
        sampleProduct.setCurrentLandedCost(new BigDecimal("55.00"));

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(importBatchRepository.save(any(ImportBatch.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1.000 sacas * 10 USD * 5 BRL = 50.000 BRL + 20.000 despesas = 70.000 BRL -> R$ 70,00/un
        ImportBatchItemRequest itemReq = new ImportBatchItemRequest(10L, 1000, new BigDecimal("10.00"));
        CreateImportBatchRequest req = new CreateImportBatchRequest(
                "LOTE-2026-ZERO-01",
                LocalDate.now(),
                "Moinho Mercosul",
                new BigDecimal("5.00"),
                new BigDecimal("5000.00"),
                new BigDecimal("10000.00"),
                new BigDecimal("5000.00"),
                null,
                List.of(itemReq)
        );

        backofficeService.registerImportBatch(req);

        assertEquals(new BigDecimal("70.00"), sampleProduct.getCurrentLandedCost());
        assertEquals(1000, sampleProduct.getPhysicalStock());
        assertEquals(1000, sampleProduct.getBaseStock());
    }

    @Test
    @DisplayName("Entrada de Lote com múltiplos SKUs: rateia custos proporcionais ao valor FOB de cada produto")
    void shouldRegisterImportBatchWithMultipleSkusAndAllocateProportionallyByFob() {
        Product sampleProductB = new Product();
        sampleProductB.setId(20L);
        sampleProductB.setPhysicalStock(200);
        sampleProductB.setBaseStock(200);
        sampleProductB.setCurrentLandedCost(new BigDecimal("80.00"));

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(productRepository.findById(20L)).thenReturn(Optional.of(sampleProductB));
        when(importBatchRepository.save(any(ImportBatch.class))).thenAnswer(inv -> inv.getArgument(0));

        // SKU A (10L): 1000 sacas * 10 USD = 10.000 USD (50% do FOB total)
        // SKU B (20L): 500 sacas * 20 USD = 10.000 USD (50% do FOB total)
        // Total FOB USD = 20.000 USD. Câmbio = 5.00 -> Total FOB BRL = 100.000 BRL
        // Custos Extras = 20.000 BRL -> Cada SKU recebe 50% = 10.000 BRL
        // SKU A Landed = (1000 * 10 * 5) + 10.000 = 60.000 BRL -> Unit = R$ 60,00
        // SKU B Landed = (500 * 20 * 5) + 10.000 = 60.000 BRL -> Unit = R$ 120,00
        ImportBatchItemRequest item1 = new ImportBatchItemRequest(10L, 1000, new BigDecimal("10.00"));
        ImportBatchItemRequest item2 = new ImportBatchItemRequest(20L, 500, new BigDecimal("20.00"));

        CreateImportBatchRequest req = new CreateImportBatchRequest(
                "LOTE-MULTI-01",
                LocalDate.now(),
                "Fornecedor Alfa",
                new BigDecimal("5.00"),
                new BigDecimal("8000.00"),
                new BigDecimal("8000.00"),
                new BigDecimal("4000.00"),
                null,
                List.of(item1, item2)
        );

        ImportBatch batch = backofficeService.registerImportBatch(req);

        assertEquals(2, batch.getItems().size());
        assertEquals(new BigDecimal("60.00"), batch.getItems().get(0).getCalculatedUnitCostBrl());
        assertEquals(new BigDecimal("120.00"), batch.getItems().get(1).getCalculatedUnitCostBrl());
    }

    // =========================================================================
    // 2. REVISÃO DE PRÉ-NOTA (reviewAndAdjustPreNota)
    // =========================================================================

    @Test
    @DisplayName("Revisão de Pré-Nota: aumento de DQ recalcula reserva de estoque (+deltaDq) e snapshots financeiros")
    void shouldReviewAndAdjustPreNotaIncreasingDqAndAdjustingReservedStock() {
        // Pedido criado na rua com DQ = 20, BQ = 10, Preço = R$ 100,00
        Order order = new Order();
        order.setId(101L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);
        order.setGrossTotal(new BigDecimal("2000.00"));
        order.setTotalCmvSnapshot(new BigDecimal("1400.00"));
        order.setShippingCostEstimate(new BigDecimal("80.00"));
        order.setEstimatedTaxSnapshot(new BigDecimal("80.00"));

        OrderItem item = new OrderItem();
        item.setId(1L);
        item.setProduct(sampleProduct);
        item.setOrderedQuantity(20);
        item.setDispatchQuantity(20);
        item.setBaseQuantity(10);
        item.setOrderedUnitPrice(new BigDecimal("100.00"));
        item.setUnitSalePrice(new BigDecimal("100.00"));
        item.setUnitCostSnapshot(new BigDecimal("70.00"));
        order.addItem(item);

        // sampleProduct possui: physicalStock = 100, reservedStock = 20 -> availableStock = 80
        when(orderRepository.findById(101L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // Backoffice revisa: altera DQ para 25 (+5 un), BQ para 15, e Preço para R$ 105,00
        ReviewOrderItemUpdateDto itemUpd = new ReviewOrderItemUpdateDto(
                10L,
                null,
                25,
                15,
                new BigDecimal("105.00")
        );
        ReviewOrderRequest reviewReq = new ReviewOrderRequest(
                "Boleto 28 dias",
                "Amanhã 09:00",
                "Entregar no fundo",
                "Ajustado volume a pedido do cliente",
                null,
                sampleClient.getCorporateName(),
                sampleClient.getCnpj(),
                sampleClient.getStateRegistration(),
                sampleClient.getIeIndicator(),
                sampleClient.getZipCode(),
                sampleClient.getStreet(),
                sampleClient.getNumber(),
                sampleClient.getNeighborhood(),
                sampleClient.getCity(),
                sampleClient.getState(),
                sampleClient.getIbgeCityCode(),
                List.of(itemUpd)
        );

        BackofficeOrderDto result = backofficeService.reviewAndAdjustPreNota(101L, reviewReq);

        assertNotNull(result);

        // 1. Reserva de estoque é ajustada pelo delta (+5): passa de 20 para 25
        assertEquals(25, sampleProduct.getReservedStock());
        assertEquals(100, sampleProduct.getPhysicalStock()); // physicalStock intacto
        assertEquals(90, sampleProduct.getBaseStock());      // baseStock intacto

        // 2. OrderItem atualizado:
        assertEquals(25, item.getDispatchQuantity());
        assertEquals(15, item.getBaseQuantity());
        assertEquals(new BigDecimal("105.00"), item.getUnitSalePrice());

        // 3. Snapshots financeiros recalculados:
        // grossTotal = 25 * 105.00 = R$ 2.625,00 (usa DQ)
        assertEquals(new BigDecimal("2625.00"), order.getGrossTotal());
        // totalCmvSnapshot = 25 * 70.00 = R$ 1.750,00 (usa DQ)
        assertEquals(new BigDecimal("1750.00"), order.getTotalCmvSnapshot());
        // shippingCostEstimate = 4.00 * 25 = R$ 100,00 (usa DQ)
        assertEquals(new BigDecimal("100.00"), order.getShippingCostEstimate());
        // estimatedTaxSnapshot (8%) = 105.00 * 15 (BQ) * 0.08 = R$ 126,00 (usa BQ!)
        assertEquals(new BigDecimal("126.00"), order.getEstimatedTaxSnapshot());
        // netProfitSnapshot = 2625 - 1750 - 126 - 100 = R$ 649,00
        assertEquals(new BigDecimal("649.00"), order.getNetProfitSnapshot());

        verify(productRepository).save(sampleProduct);
        verify(orderRepository).save(order);
    }

    @Test
    @DisplayName("Revisão de Pré-Nota: redução de DQ libera reserva de estoque (-deltaDq)")
    void shouldReviewAndAdjustPreNotaDecreasingDqAndReleasingReservedStock() {
        Order order = new Order();
        order.setId(102L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);

        OrderItem item = new OrderItem();
        item.setId(2L);
        item.setProduct(sampleProduct);
        item.setOrderedQuantity(20);
        item.setDispatchQuantity(20);
        item.setBaseQuantity(10);
        item.setOrderedUnitPrice(new BigDecimal("100.00"));
        item.setUnitSalePrice(new BigDecimal("100.00"));
        item.setUnitCostSnapshot(new BigDecimal("70.00"));
        order.addItem(item);

        when(orderRepository.findById(102L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // Reduz DQ de 20 para 15 (-5) e BQ mantém 10
        ReviewOrderItemUpdateDto itemUpd = new ReviewOrderItemUpdateDto(
                10L,
                null,
                15,
                10,
                new BigDecimal("100.00")
        );
        ReviewOrderRequest reviewReq = new ReviewOrderRequest(
                "Boleto 28 dias",
                null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                List.of(itemUpd)
        );

        backofficeService.reviewAndAdjustPreNota(102L, reviewReq);

        // reservedStock diminui de 20 para 15
        assertEquals(15, sampleProduct.getReservedStock());
        assertEquals(15, item.getDispatchQuantity());
        assertEquals(new BigDecimal("1500.00"), order.getGrossTotal()); // 15 * 100
    }

    @Test
    @DisplayName("Bloqueio de Revisão quando BQ for maior que DQ (BQ > DQ)")
    void shouldThrowExceptionWhenReviewOrderHasBqGreaterThanDq() {
        Order order = new Order();
        order.setId(103L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);

        OrderItem item = new OrderItem();
        item.setId(3L);
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(20);
        item.setBaseQuantity(10);
        item.setUnitSalePrice(new BigDecimal("100.00"));
        item.setUnitCostSnapshot(new BigDecimal("70.00"));
        order.addItem(item);

        when(orderRepository.findById(103L)).thenReturn(Optional.of(order));

        // DQ = 10, BQ = 12 (BQ maior que DQ)
        ReviewOrderItemUpdateDto itemUpd = new ReviewOrderItemUpdateDto(10L, null, 10, 12, new BigDecimal("100.00"));
        ReviewOrderRequest reviewReq = new ReviewOrderRequest(
                "Boleto 28 dias", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                List.of(itemUpd)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                backofficeService.reviewAndAdjustPreNota(103L, reviewReq)
        );

        assertTrue(ex.getMessage().contains("não pode ser maior que a Qtd. Expedição"));
    }

    @Test
    @DisplayName("Bloqueio de Revisão para pedidos com status FATURADO, ENTREGUE ou CANCELADO")
    void shouldThrowExceptionWhenReviewingLockedOrders() {
        Order order = new Order();
        order.setId(104L);
        order.setStatus(OrderStatus.FATURADO);

        when(orderRepository.findById(104L)).thenReturn(Optional.of(order));

        ReviewOrderRequest reviewReq = new ReviewOrderRequest(
                "Boleto 28 dias", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                List.of()
        );

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                backofficeService.reviewAndAdjustPreNota(104L, reviewReq)
        );

        assertTrue(ex.getMessage().contains("bloqueados para edição"));
    }

    // =========================================================================
    // 3. EMISSÃO DE NF-E (issueNfe)
    // =========================================================================

    @Test
    @DisplayName("Emissão de NF-e: baixa definitiva de DQ em physicalStock/reservedStock e de BQ em baseStock")
    void shouldIssueNfeSuccessfullyDeductingDqFromPhysicalAndReservedAndBqFromBaseStock() {
        // Pedido pronto para faturar
        Order order = new Order();
        order.setId(201L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.EM_SEPARACAO);

        // sampleProduct possui: physicalStock = 100, reservedStock = 20, baseStock = 90
        OrderItem item = new OrderItem();
        item.setId(10L);
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(20); // DQ = 20
        item.setBaseQuantity(10);     // BQ = 10
        item.setUnitSalePrice(new BigDecimal("100.00"));
        item.setUnitCostSnapshot(new BigDecimal("70.00"));
        order.addItem(item);

        when(orderRepository.findById(201L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // Gateway retorna autorizada
        NfeEmissionResult emissionMock = new NfeEmissionResult(
                true,
                "12936",
                "35261009265201000195550010000129361300129362",
                "135264200012936",
                "100 - Autorizado o uso da NF-e",
                "<nfeProc>...</nfeProc>"
        );
        when(nfeGatewayPort.emitNfe(order)).thenReturn(emissionMock);

        BackofficeOrderDto result = backofficeService.issueNfe(201L);

        assertNotNull(result);

        // 1. Baixa de DQ (20 sacas) no estoque físico e na reserva:
        // physicalStock: 100 - 20 = 80
        assertEquals(80, sampleProduct.getPhysicalStock());
        // reservedStock: 20 - 20 = 0
        assertEquals(0, sampleProduct.getReservedStock());

        // 2. Baixa de BQ (10 sacas) no saldo base fiscal:
        // baseStock: 90 - 10 = 80
        assertEquals(80, sampleProduct.getBaseStock());

        // 3. Status do pedido avança para FATURADO:
        assertEquals(OrderStatus.FATURADO, order.getStatus());
        assertEquals(NfeStatus.AUTORIZADA, order.getInvoiceData().getNfeStatus());
        assertEquals("12936", order.getInvoiceData().getNfeNumber());
        assertEquals("35261009265201000195550010000129361300129362", order.getInvoiceData().getNfeAccessKey());
        assertNotNull(order.getInvoiceData().getDanfePdfUrl());
        assertNotNull(order.getInvoiceData().getXmlUrl());

        verify(productRepository).save(sampleProduct);
        verify(orderRepository, atLeastOnce()).save(order);
    }

    @Test
    @DisplayName("Bloqueio de Emissão de NF-e quando cliente não possui Prontidão Fiscal Completa")
    void shouldBlockNfeEmissionWhenClientRegistrationIsIncomplete() {
        sampleClient.setRegistrationComplete(false); // Incompleto!

        Order order = new Order();
        order.setId(202L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        order.addItem(item);

        when(orderRepository.findById(202L)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                backofficeService.issueNfe(202L)
        );

        assertTrue(ex.getMessage().contains("Prontidão Fiscal Pendente"));
        verify(nfeGatewayPort, never()).emitNfe(any());
    }

    @Test
    @DisplayName("Tratamento de Rejeição da SEFAZ na emissão da NF-e")
    void shouldHandleSefazRejectionOnNfeEmission() {
        Order order = new Order();
        order.setId(203L);
        order.setClient(sampleClient);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        order.addItem(item);

        when(orderRepository.findById(203L)).thenReturn(Optional.of(order));

        NfeEmissionResult rejectedMock = new NfeEmissionResult(
                false,
                null,
                null,
                null,
                "Rejeição 207: CNPJ do destinatário inválido.",
                null
        );
        when(nfeGatewayPort.emitNfe(order)).thenReturn(rejectedMock);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                backofficeService.issueNfe(203L)
        );

        assertTrue(ex.getMessage().contains("Rejeição 207"));
        assertEquals(NfeStatus.REJEITADA, order.getInvoiceData().getNfeStatus());
        assertEquals("Rejeição 207: CNPJ do destinatário inválido.", order.getInvoiceData().getSefazRejectionMessage());

        // Não deve baixar estoque físico nem fiscal!
        assertEquals(100, sampleProduct.getPhysicalStock());
        assertEquals(20, sampleProduct.getReservedStock());
        assertEquals(90, sampleProduct.getBaseStock());
    }

    // =========================================================================
    // 4. CANCELAMENTO DE PEDIDO (cancelOrder)
    // =========================================================================

    @Test
    @DisplayName("Cancelamento em Pré-Nota / Separação: estorna exclusivamente a reserva de estoque (reservedStock)")
    void shouldCancelOrderInPreNotaStatusRevertingReservedStockOnly() {
        // Pedido com 20 sacas de DQ reservadas
        Order order = new Order();
        order.setId(301L);
        order.setStatus(OrderStatus.AGUARDANDO_REVISAO);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(20);
        item.setBaseQuantity(10);
        order.addItem(item);

        // sampleProduct: physical = 100, reserved = 20, base = 90
        when(orderRepository.findById(301L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        BackofficeOrderDto result = backofficeService.cancelOrder(301L);

        assertNotNull(result);

        // reservedStock diminui de 20 para 0 (liberado)
        assertEquals(0, sampleProduct.getReservedStock());
        // physicalStock e baseStock continuam intactos
        assertEquals(100, sampleProduct.getPhysicalStock());
        assertEquals(90, sampleProduct.getBaseStock());

        assertEquals(OrderStatus.CANCELADO, order.getStatus());
        assertEquals(NfeStatus.CANCELADA, order.getInvoiceData().getNfeStatus());
        verify(productRepository).save(sampleProduct);
    }

    @Test
    @DisplayName("Cancelamento de Pedido FATURADO: devolve DQ ao physicalStock e devolve BQ ao baseStock")
    void shouldCancelOrderInFaturadoStatusReturningDqToPhysicalAndBqToBaseStock() {
        // Pedido já havia sido faturado, portanto os estoques já haviam sido baixados:
        // physicalStock = 80, reservedStock = 0, baseStock = 80
        sampleProduct.setPhysicalStock(80);
        sampleProduct.setReservedStock(0);
        sampleProduct.setBaseStock(80);

        Order order = new Order();
        order.setId(302L);
        order.setStatus(OrderStatus.FATURADO);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(20); // DQ faturada e expedida = 20
        item.setBaseQuantity(10);     // BQ faturada na nota = 10
        order.addItem(item);

        when(orderRepository.findById(302L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        BackofficeOrderDto result = backofficeService.cancelOrder(302L);

        assertNotNull(result);

        // 1. DQ (20) é devolvida integralmente ao physicalStock: 80 + 20 = 100
        assertEquals(100, sampleProduct.getPhysicalStock());

        // 2. BQ (10) é devolvida integralmente ao saldo base fiscal baseStock: 80 + 10 = 90
        assertEquals(90, sampleProduct.getBaseStock());

        // 3. reservedStock permanece 0
        assertEquals(0, sampleProduct.getReservedStock());

        assertEquals(OrderStatus.CANCELADO, order.getStatus());
        assertEquals(NfeStatus.CANCELADA, order.getInvoiceData().getNfeStatus());
        verify(productRepository).save(sampleProduct);
    }
}
