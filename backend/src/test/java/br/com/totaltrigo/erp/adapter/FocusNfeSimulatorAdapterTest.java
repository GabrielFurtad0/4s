package br.com.totaltrigo.erp.adapter;

import br.com.totaltrigo.erp.adapter.NfeGatewayPort.NfeEmissionResult;
import br.com.totaltrigo.erp.domain.enums.IeIndicator;
import br.com.totaltrigo.erp.domain.model.Client;
import br.com.totaltrigo.erp.domain.model.Order;
import br.com.totaltrigo.erp.domain.model.OrderItem;
import br.com.totaltrigo.erp.domain.model.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FocusNfeSimulatorAdapterTest {

    private FocusNfeSimulatorAdapter adapter;
    private Client sampleClient;
    private Product sampleProduct;

    @BeforeEach
    void setUp() {
        adapter = new FocusNfeSimulatorAdapter();

        sampleClient = new Client();
        sampleClient.setId(1L);
        sampleClient.setCorporateName("TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA");
        sampleClient.setTradeName("Panificadora Real");
        sampleClient.setCnpj("09.265.201/0001-95");
        sampleClient.setStateRegistration("149.932.895.118");
        sampleClient.setIeIndicator(IeIndicator.CONTRIBUINTE);
        sampleClient.setStreet("Rua Marco Aurelio Marliani");
        sampleClient.setNumber("59");
        sampleClient.setComplement("SUBSL");
        sampleClient.setNeighborhood("Jardim Almeida Prado");
        sampleClient.setCity("São Paulo");
        sampleClient.setState("SP");
        sampleClient.setZipCode("04854-170");
        sampleClient.setIbgeCityCode("3550308");
        sampleClient.setRegistrationComplete(true);

        sampleProduct = new Product();
        sampleProduct.setId(10L);
        sampleProduct.setSkuCode("FAR-ESP-25");
        sampleProduct.setErpCode("0001");
        sampleProduct.setName("Farinha de Trigo Especial 25kg");
        sampleProduct.setShortName("Especial 25kg");
        sampleProduct.setUnitOfMeasure("SA");
        sampleProduct.setUnitsPerBox(1);
        sampleProduct.setPhysicalStock(100);
        sampleProduct.setReservedStock(0);
        sampleProduct.setBaseStock(100);
        sampleProduct.setCurrentLandedCost(new BigDecimal("70.00"));
        sampleProduct.setBaseListPrice(new BigDecimal("110.00"));
        sampleProduct.setNcm("11010010");
        sampleProduct.setDefaultCfopInternal("5102");
        sampleProduct.setDefaultCfopInterstate("6102");
        sampleProduct.setEstimatedTaxRate(new BigDecimal("8.00"));
    }

    @Test
    @DisplayName("Geração do XML NF-e 4.00: qCom e vProd usam BQ, com uCom=SACAS, ICMS20 CST 20, PIS/COFINS CST 09 e vNF=vProd(BQ)")
    void shouldGenerateXmlWithBqQuantitiesAndValuesAndIcms20FiscalStructure() {
        // Cenário: Pedido entregando 20 sacas (DQ = 20) com faturamento fiscal de 10 sacas (BQ = 10)
        Order order = new Order();
        order.setId(1001L);
        order.setClient(sampleClient);
        order.setNotesForInvoiceOrDriver("Pedido com bonificação física");

        OrderItem item = new OrderItem();
        item.setId(1L);
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(20); // DQ = 20
        item.setBaseQuantity(10);     // BQ = 10
        item.setUnitSalePrice(new BigDecimal("110.00"));
        order.addItem(item);

        NfeEmissionResult result = adapter.emitNfe(order);

        // 1. Verificações do resultado da autorização
        assertTrue(result.authorized(), "NF-e deve ser autorizada com sucesso");
        assertNotNull(result.nfeNumber(), "Número da NF-e deve ser gerado");
        assertNotNull(result.accessKey(), "Chave de acesso deve ser gerada");
        assertEquals(44, result.accessKey().length(), "Chave de acesso SEFAZ deve ter 44 dígitos");
        assertNotNull(result.protocolNumber(), "Protocolo SEFAZ deve ser gerado");
        assertNotNull(result.xmlContent(), "XML da NF-e deve ser gerado");

        String xml = result.xmlContent();

        // 2. Validação da Qtd. Comercial (<qCom>) e Valor do Produto (<vProd>):
        // Devem usar ESTRITAMENTE a Qtd. Base (BQ = 10), e NÃO a Qtd. Expedição (DQ = 20)
        assertTrue(xml.contains("<qCom>10.0000</qCom>"), "XML deve conter qCom igual a BQ (10.0000)");
        assertTrue(xml.contains("<qTrib>10.0000</qTrib>"), "XML deve conter qTrib igual a BQ (10.0000)");
        assertTrue(xml.contains("<vUnCom>110.0000</vUnCom>"), "XML deve conter vUnCom R$ 110.0000");
        assertTrue(xml.contains("<vProd>1100.00</vProd>"), "XML deve conter vProd = 10 * 110.00 = R$ 1100.00");
        assertTrue(xml.contains("<uCom>SACAS</uCom>"), "XML deve conter unidade de medida SACAS");
        assertTrue(xml.contains("<uTrib>SACAS</uTrib>"), "XML deve conter unidade tributável SACAS");

        // 3. Validação do Grupo ICMS20 (CST 20 - Redução de Base de Cálculo de Farinha de Trigo no RICMS/SP):
        // Base de cálculo reduzida a 58.33% com alíquota nominal de 12% (Carga efetiva de 7.00%)
        // vBC = 1100.00 * 0.5833 = 641.63
        // vICMS = 641.63 * 0.12 = 77.00
        assertTrue(xml.contains("<ICMS20>"), "XML deve conter tag <ICMS20>");
        assertTrue(xml.contains("<CST>20</CST>"), "XML deve conter CST 20");
        assertTrue(xml.contains("<pRedBC>58.33</pRedBC>"), "XML deve conter percentual de redução pRedBC = 58.33");
        assertTrue(xml.contains("<vBC>641.63</vBC>"), "XML deve conter vBC = 641.63");
        assertTrue(xml.contains("<pICMS>12.0000</pICMS>"), "XML deve conter alíquota pICMS = 12.0000");
        assertTrue(xml.contains("<vICMS>77.00</vICMS>"), "XML deve conter vICMS = 77.00");

        // 4. Validação de PIS e COFINS não tributados (CST 09 - Operação com Suspensão / Não Tributada):
        assertTrue(xml.contains("<PIS><PISNT><CST>09</CST></PISNT></PIS>"), "XML deve conter PIS CST 09");
        assertTrue(xml.contains("<COFINS><COFINSNT><CST>09</CST></COFINSNT></COFINS>"), "XML deve conter COFINS CST 09");

        // 5. Validação dos Totalizadores da NF-e:
        // vNF deve ser exatamente igual à soma de vProd da BQ (R$ 1.100,00)
        assertTrue(xml.contains("<vNF>1100.00</vNF>"), "vNF da NF-e deve ser igual à soma de vProd da BQ");

        // 6. Observação fiscal legal obrigatória:
        assertTrue(xml.contains("REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS"), "XML deve conter menção à redução do Anexo III");
        assertTrue(xml.contains("Pedido com bonificação física"), "XML deve incluir notas complementares");
    }

    @Test
    @DisplayName("Geração do XML NF-e com múltiplos itens: totalização correta de vProd, vBC, vICMS e vNF baseados em BQ")
    void shouldCalculateTotalsInXmlWhenMultipleItemsWithDifferentBqArePresent() {
        Product sampleProductB = new Product();
        sampleProductB.setId(20L);
        sampleProductB.setSkuCode("FAR-PRE-25");
        sampleProductB.setErpCode("0002");
        sampleProductB.setName("Farinha de Trigo Premium 25kg");
        sampleProductB.setNcm("11010010");
        sampleProductB.setDefaultCfopInternal("5102");
        sampleProductB.setDefaultCfopInterstate("6102");

        Order order = new Order();
        order.setId(1002L);
        order.setClient(sampleClient);

        // Item 1: BQ = 10, DQ = 20, Preço = 100.00 -> vProd = 1000.00, vBC = 583.30, vICMS = 70.00
        OrderItem item1 = new OrderItem();
        item1.setProduct(sampleProduct);
        item1.setDispatchQuantity(20);
        item1.setBaseQuantity(10);
        item1.setUnitSalePrice(new BigDecimal("100.00"));
        order.addItem(item1);

        // Item 2: BQ = 5, DQ = 10, Preço = 80.00 -> vProd = 400.00, vBC = 233.32, vICMS = 28.00
        OrderItem item2 = new OrderItem();
        item2.setProduct(sampleProductB);
        item2.setDispatchQuantity(10);
        item2.setBaseQuantity(5);
        item2.setUnitSalePrice(new BigDecimal("80.00"));
        order.addItem(item2);

        // Totais esperados:
        // totalVProd = 1000.00 + 400.00 = 1400.00
        // totalVBC = 583.30 + 233.32 = 816.62
        // totalVICMS = 70.00 + 28.00 = 98.00
        NfeEmissionResult result = adapter.emitNfe(order);

        assertTrue(result.authorized());
        String xml = result.xmlContent();

        assertTrue(xml.contains("<vProd>1400.00</vProd>"));
        assertTrue(xml.contains("<vBC>816.62</vBC>"));
        assertTrue(xml.contains("<vICMS>98.00</vICMS>"));
        assertTrue(xml.contains("<vNF>1400.00</vNF>"));
    }

    @Test
    @DisplayName("Rejeição 207 da SEFAZ quando CNPJ/CPF for menor que 11 dígitos ou nulo")
    void shouldRejectWhenCnpjIsInvalidOrMissing() {
        sampleClient.setCnpj("12345"); // CNPJ inválido (< 11 dígitos)

        Order order = new Order();
        order.setId(1003L);
        order.setClient(sampleClient);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertFalse(result.authorized());
        assertNull(result.nfeNumber());
        assertNull(result.accessKey());
        assertTrue(result.statusMessage().contains("Rejeição 207"));
    }

    @Test
    @DisplayName("Rejeição 270 da SEFAZ quando Código de Município IBGE não tiver 7 dígitos")
    void shouldRejectWhenIbgeCityCodeIsInvalidOrMissing() {
        sampleClient.setIbgeCityCode("35503"); // 5 dígitos em vez de 7

        Order order = new Order();
        order.setId(1004L);
        order.setClient(sampleClient);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertFalse(result.authorized());
        assertNull(result.nfeNumber());
        assertNull(result.accessKey());
        assertTrue(result.statusMessage().contains("Rejeição 270"));
    }

    @Test
    @DisplayName("Emissão Interestadual: idDest=2 e CFOP interestadual (6102) quando cliente for fora de SP")
    void shouldSetInterstateCfopAndDestinationWhenClientOutsideSp() {
        sampleClient.setState("RJ"); // Rio de Janeiro (Interestadual)

        Order order = new Order();
        order.setId(1005L);
        order.setClient(sampleClient);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        item.setUnitSalePrice(new BigDecimal("100.00"));
        order.addItem(item);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertTrue(result.authorized());
        String xml = result.xmlContent();

        assertTrue(xml.contains("<idDest>2</idDest>"), "idDest deve ser 2 para operações interestaduais");
        assertTrue(xml.contains("<CFOP>6102</CFOP>"), "CFOP deve ser 6102 para saída interestadual");
    }

    @Test
    @DisplayName("Emissão Interna (SP): idDest=1 e CFOP interno (5102) para cliente em São Paulo")
    void shouldSetInternalCfopAndDestinationWhenClientInSp() {
        sampleClient.setState("SP");

        Order order = new Order();
        order.setId(1006L);
        order.setClient(sampleClient);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        item.setUnitSalePrice(new BigDecimal("100.00"));
        order.addItem(item);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertTrue(result.authorized());
        String xml = result.xmlContent();

        assertTrue(xml.contains("<idDest>1</idDest>"), "idDest deve ser 1 para operações internas dentro de SP");
        assertTrue(xml.contains("<CFOP>5102</CFOP>"), "CFOP deve ser 5102 para saída interna dentro de SP");
    }

    @Test
    @DisplayName("Definição de indIEDest e tag IE para cliente Contribuinte com Inscrição Estadual válida")
    void shouldSetIndIeDestContribuinteWithIeTag() {
        sampleClient.setIeIndicator(IeIndicator.CONTRIBUINTE);
        sampleClient.setStateRegistration("149.932.895.118");

        Order order = new Order();
        order.setId(1007L);
        order.setClient(sampleClient);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        item.setUnitSalePrice(new BigDecimal("100.00"));
        order.addItem(item);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertTrue(result.authorized());
        String xml = result.xmlContent();

        assertTrue(xml.contains("<indIEDest>1</indIEDest>"));
        assertTrue(xml.contains("<IE>149932895118</IE>"));
    }

    @Test
    @DisplayName("Definição de indIEDest para cliente ISENTO")
    void shouldSetIndIeDestIsento() {
        sampleClient.setIeIndicator(IeIndicator.ISENTO);
        sampleClient.setStateRegistration("ISENTO");

        Order order = new Order();
        order.setId(1008L);
        order.setClient(sampleClient);

        OrderItem item = new OrderItem();
        item.setProduct(sampleProduct);
        item.setDispatchQuantity(10);
        item.setBaseQuantity(10);
        item.setUnitSalePrice(new BigDecimal("100.00"));
        order.addItem(item);

        NfeEmissionResult result = adapter.emitNfe(order);

        assertTrue(result.authorized());
        String xml = result.xmlContent();

        assertTrue(xml.contains("<indIEDest>2</indIEDest>"));
        assertFalse(xml.contains("<indIEDest>2</indIEDest><IE>"));
    }
}
