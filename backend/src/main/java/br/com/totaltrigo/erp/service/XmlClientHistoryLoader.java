package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.enums.FinancialStatus;
import br.com.totaltrigo.erp.domain.enums.IeIndicator;
import br.com.totaltrigo.erp.domain.enums.PurchaseProfile;
import br.com.totaltrigo.erp.domain.model.Client;
import br.com.totaltrigo.erp.domain.model.ClientSkuPrice;
import br.com.totaltrigo.erp.domain.model.Product;
import br.com.totaltrigo.erp.repository.ClientRepository;
import br.com.totaltrigo.erp.repository.ClientSkuPriceRepository;
import br.com.totaltrigo.erp.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.File;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Stream;

/**
 * Carregador automático do histórico real de clientes e preços praticados a partir
 * dos arquivos XML de NF-e (ex: pasta NotasJan26).
 */
@Service
public class XmlClientHistoryLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(XmlClientHistoryLoader.class);

    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;
    private final ClientSkuPriceRepository clientSkuPriceRepository;

    public XmlClientHistoryLoader(
            ClientRepository clientRepository,
            ProductRepository productRepository,
            ClientSkuPriceRepository clientSkuPriceRepository
    ) {
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
        this.clientSkuPriceRepository = clientSkuPriceRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            Map<String, Object> summary = importFromXmlFolder(null);
            log.info("XmlClientHistoryLoader concluído na inicialização: {}", summary);
        } catch (Exception e) {
            log.warn("Não foi possível importar pasta de XMLs na inicialização: {}", e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> importFromXmlFolder(String customFolderPath) {
        Path folder = resolveXmlFolder(customFolderPath);
        Map<String, Object> result = new LinkedHashMap<>();
        if (folder == null || !Files.isDirectory(folder)) {
            result.put("importedFiles", 0);
            result.put("clientsCreated", 0);
            result.put("clientsUpdated", 0);
            result.put("pricesUpdated", 0);
            result.put("message", "Pasta de XMLs não encontrada nos caminhos padrão.");
            return result;
        }

        List<Product> allProducts = productRepository.findAllByOrderByIdAsc();
        Map<String, Product> productBySkuCode = new HashMap<>();
        for (Product p : allProducts) {
            productBySkuCode.put(p.getSkuCode().toUpperCase(), p);
            if (p.getSkuCode().endsWith("-05")) productBySkuCode.put("05", p);
            if (p.getSkuCode().endsWith("-02")) productBySkuCode.put("02", p);
            if (p.getSkuCode().endsWith("-03")) productBySkuCode.put("03", p);
            if (p.getErpCode() != null) productBySkuCode.put(p.getErpCode().trim(), p);
        }

        // Indexa clientes existentes pelos dígitos limpos do CNPJ/CPF
        Map<String, Client> clientByCleanDoc = new HashMap<>();
        for (Client c : clientRepository.findAll()) {
            if (c.getCnpj() != null) {
                String clean = c.getCnpj().replaceAll("\\D", "");
                if (!clean.isEmpty()) {
                    clientByCleanDoc.put(clean, c);
                }
            }
        }

        List<Path> xmlFiles;
        try (Stream<Path> paths = Files.list(folder)) {
            xmlFiles = paths
                    .filter(p -> p.getFileName().toString().toLowerCase().endsWith(".xml"))
                    .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                    .toList();
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao listar arquivos XML em " + folder + ": " + e.getMessage(), e);
        }

        int filesProcessed = 0;
        int clientsCreated = 0;
        int clientsUpdated = 0;
        int pricesUpdated = 0;

        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(false);

        for (Path xmlPath : xmlFiles) {
            try {
                DocumentBuilder db = dbf.newDocumentBuilder();
                Document doc = db.parse(xmlPath.toFile());
                doc.getDocumentElement().normalize();

                Element ide = firstElement(doc.getDocumentElement(), "ide");
                Element dest = firstElement(doc.getDocumentElement(), "dest");
                if (dest == null) continue;

                String rawCnpj = textOf(dest, "CNPJ");
                String rawCpf = textOf(dest, "CPF");
                String rawDoc = (rawCnpj != null && !rawCnpj.isBlank()) ? rawCnpj : rawCpf;
                if (rawDoc == null || rawDoc.isBlank()) continue;

                String cleanDoc = rawDoc.replaceAll("\\D", "");
                if (cleanDoc.isEmpty()) continue;

                String xNome = textOf(dest, "xNome");
                String ie = textOf(dest, "IE");
                String indIeDest = textOf(dest, "indIEDest");

                Element enderDest = firstElement(dest, "enderDest");
                String xLgr = enderDest != null ? textOf(enderDest, "xLgr") : null;
                String nro = enderDest != null ? textOf(enderDest, "nro") : null;
                String xCpl = enderDest != null ? textOf(enderDest, "xCpl") : null;
                String xBairro = enderDest != null ? textOf(enderDest, "xBairro") : null;
                String cMun = enderDest != null ? textOf(enderDest, "cMun") : null;
                String xMun = enderDest != null ? textOf(enderDest, "xMun") : null;
                String uf = enderDest != null ? textOf(enderDest, "UF") : null;
                String cep = enderDest != null ? textOf(enderDest, "CEP") : null;
                String fone = enderDest != null ? textOf(enderDest, "fone") : null;

                LocalDate emissionDate = parseEmissionDate(ide != null ? textOf(ide, "dhEmi") : null);
                Element totalEl = firstElement(doc.getDocumentElement(), "ICMSTot");
                BigDecimal vNf = parseDecimal(totalEl != null ? textOf(totalEl, "vNF") : null);

                Client client = clientByCleanDoc.get(cleanDoc);
                boolean isNew = false;
                if (client == null) {
                    client = new Client();
                    client.setCorporateName(xNome != null && !xNome.isBlank() ? xNome.trim() : "CLIENTE " + cleanDoc);
                    client.setTradeName(simplifyTradeName(client.getCorporateName()));
                    client.setCnpj(formatDocument(cleanDoc));
                    client.setDefaultPaymentTerms("Boleto 28 dias");
                    client.setAveragePurchaseCycleDays(20);
                    client.setFinancialStatus(FinancialStatus.EM_DIA);
                    client.setPurchaseProfile(PurchaseProfile.INDUSTRIALIZACAO);
                    client.setContactName("Comprador");
                    isNew = true;
                }

                if (ie != null && !ie.isBlank()) {
                    client.setStateRegistration(ie.trim());
                }
                if ("2".equals(indIeDest) || "ISENTO".equalsIgnoreCase(ie)) {
                    client.setIeIndicator(IeIndicator.ISENTO);
                } else if ("9".equals(indIeDest)) {
                    client.setIeIndicator(IeIndicator.NAO_CONTRIBUINTE);
                } else {
                    client.setIeIndicator(IeIndicator.CONTRIBUINTE);
                }

                if (xLgr != null && !xLgr.isBlank()) client.setStreet(xLgr.trim());
                if (nro != null && !nro.isBlank()) client.setNumber(nro.trim());
                if (xCpl != null && !xCpl.isBlank()) client.setComplement(xCpl.trim());
                if (xBairro != null && !xBairro.isBlank()) client.setNeighborhood(xBairro.trim());
                if (cMun != null && !cMun.isBlank()) client.setIbgeCityCode(cMun.trim());
                if (xMun != null && !xMun.isBlank()) client.setCity(xMun.trim());
                if (uf != null && !uf.isBlank()) client.setState(uf.trim());
                if (cep != null && !cep.isBlank()) client.setZipCode(formatCep(cep.trim()));
                if (fone != null && !fone.isBlank() && (client.getPhone() == null || client.getPhone().isBlank())) {
                    client.setPhone(fone.trim());
                }

                if (vNf != null && vNf.compareTo(BigDecimal.ZERO) > 0) {
                    client.setLastOrderTotal(vNf);
                }
                if (client.getLastPurchaseDate() == null && emissionDate != null) {
                    client.setLastPurchaseDate(emissionDate);
                }

                boolean hasValidDoc = cleanDoc.length() >= 11;
                boolean hasValidAddress = client.getStreet() != null && !client.getStreet().isBlank();
                boolean hasValidIbge = client.getIbgeCityCode() != null && client.getIbgeCityCode().trim().length() == 7;
                client.setRegistrationComplete(hasValidDoc && hasValidAddress && hasValidIbge);

                client = clientRepository.save(client);
                clientByCleanDoc.put(cleanDoc, client);
                if (isNew) {
                    clientsCreated++;
                } else {
                    clientsUpdated++;
                }

                // Garante memória de preços base para todos os 3 SKUs do cliente
                for (Product p : allProducts) {
                    final Client savedClient = client;
                    clientSkuPriceRepository.findByClientIdAndProductId(savedClient.getId(), p.getId())
                            .orElseGet(() -> {
                                ClientSkuPrice baseCsp = new ClientSkuPrice();
                                baseCsp.setClient(savedClient);
                                baseCsp.setProduct(p);
                                baseCsp.setLastPracticedPrice(p.getBaseListPrice());
                                baseCsp.setAgreedStandardPrice(p.getBaseListPrice());
                                baseCsp.setLastOrderDate(emissionDate != null ? emissionDate : LocalDate.now().minusDays(15));
                                return clientSkuPriceRepository.save(baseCsp);
                            });
                }

                // Extrai itens <det> e atualiza o último vUnCom praticado
                NodeList detNodes = doc.getDocumentElement().getElementsByTagName("det");
                for (int i = 0; i < detNodes.getLength(); i++) {
                    if (!(detNodes.item(i) instanceof Element detEl)) continue;
                    Element prodEl = firstElement(detEl, "prod");
                    if (prodEl == null) continue;

                    String cProd = textOf(prodEl, "cProd");
                    String vUnComStr = textOf(prodEl, "vUnCom");
                    if (cProd == null || vUnComStr == null) continue;

                    Product matchedProduct = resolveProductByCode(cProd.trim(), productBySkuCode);
                    BigDecimal vUnCom = parseDecimal(vUnComStr);
                    if (matchedProduct != null && vUnCom != null && vUnCom.compareTo(BigDecimal.ZERO) > 0) {
                        final Client savedClient = client;
                        ClientSkuPrice csp = clientSkuPriceRepository
                                .findByClientIdAndProductId(savedClient.getId(), matchedProduct.getId())
                                .orElseGet(() -> {
                                    ClientSkuPrice n = new ClientSkuPrice();
                                    n.setClient(savedClient);
                                    n.setProduct(matchedProduct);
                                    return n;
                                });
                        csp.setLastPracticedPrice(vUnCom);
                        csp.setAgreedStandardPrice(vUnCom);
                        if (emissionDate != null) {
                            csp.setLastOrderDate(emissionDate);
                        }
                        clientSkuPriceRepository.save(csp);
                        pricesUpdated++;
                    }
                }

                filesProcessed++;
            } catch (Exception e) {
                log.warn("Falha ao processar XML {}: {}", xmlPath.getFileName(), e.getMessage());
            }
        }

        result.put("folder", folder.toAbsolutePath().toString());
        result.put("importedFiles", filesProcessed);
        result.put("clientsCreated", clientsCreated);
        result.put("clientsUpdated", clientsUpdated);
        result.put("pricesUpdated", pricesUpdated);
        result.put("totalClientsInDb", clientRepository.count());
        return result;
    }

    private Path resolveXmlFolder(String customFolderPath) {
        List<String> candidates = new ArrayList<>();
        if (customFolderPath != null && !customFolderPath.isBlank()) {
            candidates.add(customFolderPath.trim());
        }
        candidates.add("../automacao-planilha/notas/NotasJan26");
        candidates.add("./automacao-planilha/notas/NotasJan26");
        candidates.add("automacao-planilha/notas/NotasJan26");

        for (String c : candidates) {
            Path p = Paths.get(c).toAbsolutePath().normalize();
            File f = p.toFile();
            if (f.exists() && f.isDirectory()) {
                return p;
            }
        }
        return null;
    }

    private Product resolveProductByCode(String cProd, Map<String, Product> productBySkuCode) {
        if (productBySkuCode.containsKey(cProd.toUpperCase())) {
            return productBySkuCode.get(cProd.toUpperCase());
        }
        String cleanDigits = cProd.replaceAll("\\D", "");
        if ("5".equals(cleanDigits) || "05".equals(cleanDigits)) return productBySkuCode.get("05");
        if ("2".equals(cleanDigits) || "02".equals(cleanDigits)) return productBySkuCode.get("02");
        if ("3".equals(cleanDigits) || "03".equals(cleanDigits)) return productBySkuCode.get("03");
        return null;
    }

    private static Element firstElement(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        if (list.getLength() > 0 && list.item(0) instanceof Element el) {
            return el;
        }
        return null;
    }

    private static String textOf(Element parent, String tagName) {
        Element el = firstElement(parent, tagName);
        return el != null && el.getTextContent() != null ? el.getTextContent().trim() : null;
    }

    private static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return new BigDecimal(raw.trim()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalDate parseEmissionDate(String dhEmi) {
        if (dhEmi == null || dhEmi.isBlank()) return null;
        try {
            return OffsetDateTime.parse(dhEmi.trim()).toLocalDate();
        } catch (Exception e) {
            if (dhEmi.length() >= 10) {
                try {
                    return LocalDate.parse(dhEmi.substring(0, 10));
                } catch (Exception ignored) {
                }
            }
            return null;
        }
    }

    private static String formatDocument(String digits) {
        if (digits.length() == 14) {
            return String.format("%s.%s.%s/%s-%s",
                    digits.substring(0, 2),
                    digits.substring(2, 5),
                    digits.substring(5, 8),
                    digits.substring(8, 12),
                    digits.substring(12, 14));
        }
        return digits;
    }

    private static String formatCep(String rawCep) {
        String digits = rawCep.replaceAll("\\D", "");
        if (digits.length() == 8) {
            return digits.substring(0, 5) + "-" + digits.substring(5);
        }
        return rawCep;
    }

    private static String simplifyTradeName(String corporateName) {
        if (corporateName == null) return "Cliente";
        return corporateName
                .replaceAll("(?i)\\b(LTDA|EPP|ME|EIRELI|S/A|SA|COMERCIO DE PAES E DOCES|COMERCIO DE ALIMENTOS)\\b", "")
                .replaceAll("\\s{2,}", " ")
                .trim();
    }
}
