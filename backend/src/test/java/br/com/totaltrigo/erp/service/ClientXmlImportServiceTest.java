package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.enums.FinancialStatus;
import br.com.totaltrigo.erp.domain.enums.IeIndicator;
import br.com.totaltrigo.erp.domain.enums.PurchaseProfile;
import br.com.totaltrigo.erp.domain.model.Client;
import br.com.totaltrigo.erp.domain.model.ClientSkuPrice;
import br.com.totaltrigo.erp.domain.model.Product;
import br.com.totaltrigo.erp.dto.ApiDtos.XmlClientImportResult;
import br.com.totaltrigo.erp.repository.ClientRepository;
import br.com.totaltrigo.erp.repository.ClientSkuPriceRepository;
import br.com.totaltrigo.erp.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientXmlImportServiceTest {

    @Mock
    private ClientRepository clientRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientSkuPriceRepository clientSkuPriceRepository;

    @InjectMocks
    private ClientXmlImportService clientXmlImportService;

    private Product prod1;
    private Product prod2;

    @BeforeEach
    void setUp() {
        prod1 = new Product();
        prod1.setId(1L);
        prod1.setSkuCode("SKU-05");
        prod1.setName("Farinha Tipo 1 25kg");
        prod1.setBaseListPrice(new BigDecimal("85.00"));

        prod2 = new Product();
        prod2.setId(2L);
        prod2.setSkuCode("SKU-02");
        prod2.setName("Pré-Mistura Francês 25kg");
        prod2.setBaseListPrice(new BigDecimal("78.00"));

        when(productRepository.findAllByOrderByIdAsc()).thenReturn(List.of(prod1, prod2));
        when(clientRepository.findAll()).thenReturn(Collections.emptyList());
        when(clientRepository.save(any(Client.class))).thenAnswer(invocation -> {
            Client c = invocation.getArgument(0);
            if (c.getId() == null) c.setId(10L);
            return c;
        });
        when(clientSkuPriceRepository.findByClientIdAndProductId(anyLong(), anyLong()))
                .thenReturn(Optional.empty());
        when(clientSkuPriceRepository.save(any(ClientSkuPrice.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("Deve importar com sucesso cliente a partir de XML NF-e oficial com tag <dest>")
    void testImportNfeXml() {
        String nfeXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                  <NFe>
                    <infNFe Id="NFe35260109265201000195550010000129261000129260">
                      <ide>
                        <dhEmi>2026-01-15T10:30:00-03:00</dhEmi>
                      </ide>
                      <dest>
                        <CNPJ>53068994000139</CNPJ>
                        <xNome>PANIFICADORA ESTRELA DO BRASIL LTDA</xNome>
                        <enderDest>
                          <xLgr>Rua das Flores</xLgr>
                          <nro>123</nro>
                          <xBairro>Jardim Paulista</xBairro>
                          <cMun>3550308</cMun>
                          <xMun>São Paulo</xMun>
                          <UF>SP</UF>
                          <CEP>01401000</CEP>
                          <fone>11988887777</fone>
                        </enderDest>
                        <indIEDest>1</indIEDest>
                        <IE>112233445566</IE>
                      </dest>
                      <total>
                        <ICMSTot>
                          <vNF>1700.00</vNF>
                        </ICMSTot>
                      </total>
                      <det nItem="1">
                        <prod>
                          <cProd>05</cProd>
                          <xProd>Farinha Tipo 1 25kg</xProd>
                          <vUnCom>84.50</vUnCom>
                        </prod>
                      </det>
                    </infNFe>
                  </NFe>
                </nfeProc>
                """;

        MockMultipartFile file = new MockMultipartFile(
                "files",
                "nota_fiscal_12926.xml",
                "text/xml",
                nfeXml.getBytes()
        );

        XmlClientImportResult result = clientXmlImportService.importFromFiles(new MockMultipartFile[]{file});

        assertNotNull(result);
        assertEquals(1, result.totalFilesProcessed());
        assertEquals(1, result.clientsCreated());
        assertEquals(0, result.clientsUpdated());
        assertTrue(result.pricesUpdated() >= 1);
        assertTrue(result.warnings().isEmpty());

        verify(clientRepository, atLeastOnce()).save(any(Client.class));
        verify(clientSkuPriceRepository, atLeastOnce()).save(any(ClientSkuPrice.class));
    }

    @Test
    @DisplayName("Deve importar com sucesso cliente a partir de XML genérico exportado com tags <clientes><cliente>")
    void testImportGenericXml() {
        String genericXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <clientes>
                  <cliente>
                    <cnpj>12345678000195</cnpj>
                    <razaoSocial>PADARIA E CONFEITARIA CENTRAL LTDA</razaoSocial>
                    <nomeFantasia>Padaria Central</nomeFantasia>
                    <inscricaoEstadual>987654321</inscricaoEstadual>
                    <logradouro>Av. Paulista</logradouro>
                    <numero>1000</numero>
                    <bairro>Bela Vista</bairro>
                    <cidade>São Paulo</cidade>
                    <uf>SP</uf>
                    <cep>01310100</cep>
                    <codigoIbge>3550308</codigoIbge>
                    <telefone>1133334444</telefone>
                    <contato>Seu Manoel</contato>
                    <condicaoPagamento>Boleto 28 dias</condicaoPagamento>
                    <ciclo>15</ciclo>
                  </cliente>
                </clientes>
                """;

        MockMultipartFile file = new MockMultipartFile(
                "files",
                "clientes_export.xml",
                "text/xml",
                genericXml.getBytes()
        );

        XmlClientImportResult result = clientXmlImportService.importFromFiles(new MockMultipartFile[]{file});

        assertNotNull(result);
        assertEquals(1, result.totalFilesProcessed());
        assertEquals(1, result.clientsCreated());
        assertEquals("Padaria Central", result.importedClientNames().get(0));
    }
}
