package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.enums.*;
import br.com.totaltrigo.erp.domain.model.*;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FieldSalesServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientRepository clientRepository;

    @Mock
    private ClientSkuPriceRepository clientSkuPriceRepository;

    @Mock
    private ClientNoteRepository clientNoteRepository;

    @Mock
    private VisitScheduleRepository visitScheduleRepository;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private FieldSalesService fieldSalesService;

    private Client sampleClient;
    private Product sampleProductA;
    private Product sampleProductB;

    @BeforeEach
    void setUp() {
        sampleClient = new Client();
        sampleClient.setId(1L);
        sampleClient.setCorporateName("PADARIA E CONFEITARIA ESTRELA LTDA");
        sampleClient.setTradeName("Padaria Estrela");
        sampleClient.setCnpj("12345678000195");
        sampleClient.setStateRegistration("123456789012");
        sampleClient.setIeIndicator(IeIndicator.CONTRIBUINTE);
        sampleClient.setPurchaseProfile(PurchaseProfile.INDUSTRIALIZACAO);
        sampleClient.setStreet("Rua das Flores");
        sampleClient.setNumber("123");
        sampleClient.setNeighborhood("Bela Vista");
        sampleClient.setCity("São Paulo");
        sampleClient.setState("SP");
        sampleClient.setZipCode("01310-100");
        sampleClient.setIbgeCityCode("3550308");
        sampleClient.setRegistrationComplete(true);
        sampleClient.setFinancialStatus(FinancialStatus.EM_DIA);

        sampleProductA = new Product();
        sampleProductA.setId(10L);
        sampleProductA.setSkuCode("FAR-ESP-25");
        sampleProductA.setErpCode("0001");
        sampleProductA.setName("Farinha de Trigo Especial 25kg");
        sampleProductA.setShortName("Especial 25kg");
        sampleProductA.setUnitOfMeasure("SA");
        sampleProductA.setUnitsPerBox(1);
        sampleProductA.setPhysicalStock(100);
        sampleProductA.setReservedStock(10);
        sampleProductA.setBaseStock(100);
        sampleProductA.setCurrentLandedCost(new BigDecimal("70.00"));
        sampleProductA.setBaseListPrice(new BigDecimal("100.00"));
        sampleProductA.setNcm("11010010");
        sampleProductA.setDefaultCfopInternal("5102");
        sampleProductA.setDefaultCfopInterstate("6102");
        sampleProductA.setEstimatedTaxRate(new BigDecimal("8.00"));

        sampleProductB = new Product();
        sampleProductB.setId(20L);
        sampleProductB.setSkuCode("FAR-PRE-25");
        sampleProductB.setErpCode("0002");
        sampleProductB.setName("Farinha de Trigo Premium 25kg");
        sampleProductB.setShortName("Premium 25kg");
        sampleProductB.setUnitOfMeasure("SA");
        sampleProductB.setUnitsPerBox(1);
        sampleProductB.setPhysicalStock(80);
        sampleProductB.setReservedStock(0);
        sampleProductB.setBaseStock(80);
        sampleProductB.setCurrentLandedCost(new BigDecimal("80.00"));
        sampleProductB.setBaseListPrice(new BigDecimal("120.00"));
        sampleProductB.setNcm("11010010");
        sampleProductB.setDefaultCfopInternal("5102");
        sampleProductB.setDefaultCfopInterstate("6102");
        sampleProductB.setEstimatedTaxRate(new BigDecimal("8.00"));
    }

    @Test
    @DisplayName("Criação de pedido na rua com DQ = BQ (100%): valida snapshots, frete e reserva exclusiva de physicalStock")
    void shouldCreateOrderSuccessfullyWhenDqEqualsBq100Percent() {
        // Cenário: Pedido de 20 sacas com DQ = 20 e BQ = 20, Preço R$ 100,00, Custo R$ 70,00, Imposto 8%
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));
        when(clientSkuPriceRepository.findByClientIdAndProductId(1L, 10L)).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(501L);
            return o;
        });

        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                20,
                20,
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                "Amanhã (Manhã)",
                "Entregar no fundo",
                null,
                List.of(itemReq)
        );

        BackofficeOrderDto result = fieldSalesService.createOrderFromStreet(request);

        assertNotNull(result);
        assertEquals(501L, result.id());

        // 1. Verificação matemática:
        // grossTotal = 20 * 100.00 = R$ 2.000,00 (usa DQ)
        assertEquals(new BigDecimal("2000.00"), result.grossTotal());
        // totalCmvSnapshot = 20 * 70.00 = R$ 1.400,00 (usa DQ)
        assertEquals(new BigDecimal("1400.00"), result.totalCmvSnapshot());
        // shippingCostEstimate = R$ 4,00 * 20 = R$ 80,00 (usa DQ)
        assertEquals(new BigDecimal("80.00"), result.shippingCostEstimate());
        // estimatedTaxSnapshot = 100.00 * 20 (BQ) * 0.08 = R$ 160,00
        assertEquals(new BigDecimal("160.00"), result.estimatedTaxSnapshot());
        // netProfitSnapshot = 2000 - 1400 - 160 - 80 = R$ 360,00
        assertEquals(new BigDecimal("360.00"), result.netProfitSnapshot());
        // netMarginPercentage = (360 / 2000) * 100 = 18.00%
        assertEquals(new BigDecimal("18.00"), result.netMarginPercentage());

        // 2. Verificação de estoque:
        // Apenas DQ reserva estoque: reservedStock passa de 10 para 30
        assertEquals(30, sampleProductA.getReservedStock());
        // physicalStock permanece 100 intacto (a baixa só ocorre no faturamento)
        assertEquals(100, sampleProductA.getPhysicalStock());
        // baseStock permanece 100 intacto (a baixa fiscal só ocorre no faturamento)
        assertEquals(100, sampleProductA.getBaseStock());

        // 3. Verificação de atualização do cliente
        assertEquals(LocalDate.now(), sampleClient.getLastPurchaseDate());
        assertEquals(new BigDecimal("2000.00"), sampleClient.getLastOrderTotal());
        verify(clientRepository).save(sampleClient);
    }

    @Test
    @DisplayName("Criação de pedido na rua com BQ < DQ (DQ = 20, BQ = 10): imposto incide exclusivamente sobre BQ")
    void shouldCreateOrderSuccessfullyWhenBqLessThanDq() {
        // Cenário: Pedido de 20 sacas entregues fisicamente (DQ = 20), porém 10 sacas faturadas na NF-e (BQ = 10)
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));
        when(clientSkuPriceRepository.findByClientIdAndProductId(1L, 10L)).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(502L);
            return o;
        });

        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                20,
                10,
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                "Amanhã (Tarde)",
                "Cuidado no descarregamento",
                null,
                List.of(itemReq)
        );

        BackofficeOrderDto result = fieldSalesService.createOrderFromStreet(request);

        assertNotNull(result);

        // 1. grossTotal usa DQ (20 * 100.00 = 2000.00)
        assertEquals(new BigDecimal("2000.00"), result.grossTotal());
        // 2. totalCmvSnapshot usa DQ (20 * 70.00 = 1400.00)
        assertEquals(new BigDecimal("1400.00"), result.totalCmvSnapshot());
        // 3. shippingCostEstimate = R$ 4,00 * 20 = R$ 80,00 (usa DQ)
        assertEquals(new BigDecimal("80.00"), result.shippingCostEstimate());

        // 4. estimatedTaxSnapshot (8%) incide EXCLUSIVAMENTE sobre BQ:
        // 10 sacas * R$ 100,00 * 8% = R$ 80,00 (em vez de R$ 160,00 da DQ)
        assertEquals(new BigDecimal("80.00"), result.estimatedTaxSnapshot());

        // 5. netProfitSnapshot = 2000 - 1400 - 80 (imposto BQ) - 80 (frete) = R$ 440,00
        assertEquals(new BigDecimal("440.00"), result.netProfitSnapshot());
        // netMarginPercentage = (440 / 2000) * 100 = 22.00%
        assertEquals(new BigDecimal("22.00"), result.netMarginPercentage());

        // 6. Estoque: DQ (20) reserva reservedStock (10 + 20 = 30), baseStock intacto (100)
        assertEquals(30, sampleProductA.getReservedStock());
        assertEquals(100, sampleProductA.getBaseStock());
        assertEquals(100, sampleProductA.getPhysicalStock());
    }

    @Test
    @DisplayName("Cálculo composto com múltiplos SKUs com proporções DQ e BQ distintas")
    void shouldCalculateMultipleItemsWithDifferentDqAndBqCorrectly() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));
        when(productRepository.findById(20L)).thenReturn(Optional.of(sampleProductB));
        when(clientSkuPriceRepository.findByClientIdAndProductId(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(503L);
            return o;
        });

        // Item 1: DQ = 15, BQ = 10, Preço = 100.00, Custo = 70.00, Tax = 8%
        //   Subtotal = 1500.00, CMV = 1050.00, Tax = 10 * 100 * 0.08 = 80.00
        // Item 2: DQ = 10, BQ = 5, Preço = 120.00, Custo = 80.00, Tax = 8%
        //   Subtotal = 1200.00, CMV = 800.00, Tax = 5 * 120 * 0.08 = 48.00
        // Totais:
        //   DQ Total = 25 sacos -> Frete = 25 * 4.00 = 100.00
        //   grossTotal = 1500 + 1200 = 2700.00
        //   totalCmv = 1050 + 800 = 1850.00
        //   totalTax = 80 + 48 = 128.00
        //   netProfit = 2700 - 1850 - 128 - 100 = 622.00
        //   margin = (622 / 2700) * 100 = 23.04%
        OrderItemRequest item1 = new OrderItemRequest(10L, null, 15, 10, new BigDecimal("100.00"), false);
        OrderItemRequest item2 = new OrderItemRequest(20L, null, 10, 5, new BigDecimal("120.00"), false);

        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                "Hoje",
                null,
                null,
                List.of(item1, item2)
        );

        BackofficeOrderDto result = fieldSalesService.createOrderFromStreet(request);

        assertEquals(new BigDecimal("2700.00"), result.grossTotal());
        assertEquals(new BigDecimal("1850.00"), result.totalCmvSnapshot());
        assertEquals(new BigDecimal("100.00"), result.shippingCostEstimate());
        assertEquals(new BigDecimal("128.00"), result.estimatedTaxSnapshot());
        assertEquals(new BigDecimal("622.00"), result.netProfitSnapshot());
        assertEquals(new BigDecimal("23.04"), result.netMarginPercentage());

        // Reservas de estoque individuais
        assertEquals(25, sampleProductA.getReservedStock()); // 10 + 15
        assertEquals(10, sampleProductB.getReservedStock()); // 0 + 10
    }

    @Test
    @DisplayName("Bloqueio de pedido quando a soma de BQ total for 0")
    void shouldThrowExceptionWhenTotalBqIsZero() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));

        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                20,
                0, // BQ = 0
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of(itemReq)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                fieldSalesService.createOrderFromStreet(request)
        );

        assertTrue(ex.getMessage().contains("BQ") && ex.getMessage().contains("zero"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Bloqueio de pedido quando BQ for maior que DQ (BQ > DQ)")
    void shouldThrowExceptionWhenBqIsGreaterThanDq() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));

        // DQ = 10, BQ = 15 (inválido: não se pode faturar mais do que se expede)
        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                10,
                15,
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of(itemReq)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                fieldSalesService.createOrderFromStreet(request)
        );

        assertTrue(ex.getMessage().contains("deve estar entre 0 e a Qtd. Expedição"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Bloqueio de pedido quando falta estoque físico disponível para DQ")
    void shouldThrowExceptionWhenAvailablePhysicalStockIsInsufficientForDq() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        // sampleProductA: physicalStock = 100, reservedStock = 10 -> availableStock = 90
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));

        // Solicita DQ = 95 (maior que o disponível 90)
        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                95,
                50,
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of(itemReq)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                fieldSalesService.createOrderFromStreet(request)
        );

        assertTrue(ex.getMessage().contains("Estoque disponível insuficiente"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Bloqueio de pedido sem itens ativos com DQ > 0")
    void shouldThrowExceptionWhenNoActiveItemsWithDqGreaterThanZero() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));

        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                0,
                0,
                0,
                new BigDecimal("100.00"),
                false
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of(itemReq)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                fieldSalesService.createOrderFromStreet(request)
        );

        assertTrue(ex.getMessage().contains("Adicione pelo menos 1 saco na Qtd. Expedição (DQ)"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Bloqueio de pedido quando cliente não for encontrado")
    void shouldThrowExceptionWhenClientNotFound() {
        when(clientRepository.findById(999L)).thenReturn(Optional.empty());

        CreateOrderRequest request = new CreateOrderRequest(
                999L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of()
        );

        assertThrows(IllegalArgumentException.class, () ->
                fieldSalesService.createOrderFromStreet(request)
        );
    }

    @Test
    @DisplayName("Preço promocional não deve alterar a memória de preço padrão acordado do cliente")
    void shouldNotUpdateAgreedStandardPriceWhenOrderIsPromotional() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(sampleClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProductA));

        ClientSkuPrice existingPrice = new ClientSkuPrice();
        existingPrice.setClient(sampleClient);
        existingPrice.setProduct(sampleProductA);
        existingPrice.setAgreedStandardPrice(new BigDecimal("105.00"));
        existingPrice.setLastPracticedPrice(new BigDecimal("105.00"));

        when(clientSkuPriceRepository.findByClientIdAndProductId(1L, 10L)).thenReturn(Optional.of(existingPrice));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        // Pedido promocional a R$ 90,00
        OrderItemRequest itemReq = new OrderItemRequest(
                10L,
                null,
                10,
                10,
                new BigDecimal("90.00"),
                true // Promocional!
        );
        CreateOrderRequest request = new CreateOrderRequest(
                1L,
                "Boleto 28 dias",
                null,
                null,
                null,
                List.of(itemReq)
        );

        fieldSalesService.createOrderFromStreet(request);

        // Preço praticado vira 90, mas o acordado permanece 105
        assertEquals(new BigDecimal("90.00"), existingPrice.getLastPracticedPrice());
        assertEquals(new BigDecimal("105.00"), existingPrice.getAgreedStandardPrice());
        verify(clientSkuPriceRepository).save(existingPrice);
    }
}
