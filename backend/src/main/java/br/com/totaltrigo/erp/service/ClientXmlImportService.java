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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Serviço de importação em lote de cadastros de clientes e preços via XML.
 * Suporta múltiplos formatos:
 * 1. NF-e SEFAZ padrão (<nfeProc>, <NFe>, com tags <dest>, <enderDest> e <det><prod>).
 * 2. XML genérico de exportação de ERP/Sebrae (<clientes><cliente>..., <cadastro><registro>..., etc.).
 * 3. Arquivos ZIP contendo múltiplos XMLs.
 */
@Service
public class ClientXmlImportService {

    private static final Logger log = LoggerFactory.getLogger(ClientXmlImportService.class);

    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;
    private final ClientSkuPriceRepository clientSkuPriceRepository;

    public ClientXmlImportService(
            ClientRepository clientRepository,
            ProductRepository productRepository,
            ClientSkuPriceRepository clientSkuPriceRepository
    ) {
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
        this.clientSkuPriceRepository = clientSkuPriceRepository;
    }

    private static class ImportContext {
        int filesProcessed = 0;
        int clientsCreated = 0;
        int clientsUpdated = 0;
        int pricesUpdated = 0;
        List<String> importedNames = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Client> clientByCleanDoc = new HashMap<>();
        Map<String, Product> productBySkuCode = new HashMap<>();
        List<Product> allProducts = new ArrayList<>();
    }

    @Transactional
    public XmlClientImportResult importFromFiles(MultipartFile[] files) {
        if (files == null || files.length == 0) {
            return new XmlClientImportResult(0, 0, 0, 0, List.of(), List.of("Nenhum arquivo enviado."), "Nenhum arquivo XML recebido para importação.");
        }

        ImportContext ctx = initContext();

        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "arquivo.xml";
            String lowerName = originalFilename.toLowerCase();

            try {
                if (lowerName.endsWith(".zip")) {
                    processZipStream(file.getInputStream(), originalFilename, ctx);
                } else if (lowerName.endsWith(".xml")) {
                    processXmlBytes(file.getBytes(), originalFilename, ctx);
                } else {
                    // Tenta processar como XML mesmo se a extensão for diferente (ou omitida)
                    processXmlBytes(file.getBytes(), originalFilename, ctx);
                }
            } catch (Exception e) {
                log.warn("Erro ao processar arquivo {}: {}", originalFilename, e.getMessage());
                ctx.warnings.add("Erro em " + originalFilename + ": " + e.getMessage());
            }
        }

        String msg = String.format("Importação concluída: %d arquivo(s) processado(s). %d novo(s) cliente(s) cadastrado(s), %d atualizado(s) e %d preço(s) registrado(s).",
                ctx.filesProcessed, ctx.clientsCreated, ctx.clientsUpdated, ctx.pricesUpdated);

        return new XmlClientImportResult(
                ctx.filesProcessed,
                ctx.clientsCreated,
                ctx.clientsUpdated,
                ctx.pricesUpdated,
                ctx.importedNames,
                ctx.warnings,
                msg
        );
    }

    @Transactional
    public XmlClientImportResult importFromRawXml(String xmlContent, String sourceName) {
        if (xmlContent == null || xmlContent.isBlank()) {
            return new XmlClientImportResult(0, 0, 0, 0, List.of(), List.of("Conteúdo XML vazio."), "Nenhum conteúdo recebido.");
        }

        ImportContext ctx = initContext();
        String name = (sourceName != null && !sourceName.isBlank()) ? sourceName : "upload.xml";

        try {
            processXmlBytes(xmlContent.getBytes(StandardCharsets.UTF_8), name, ctx);
        } catch (Exception e) {
            log.warn("Erro ao processar XML bruto: {}", e.getMessage());
            ctx.warnings.add("Erro ao processar XML: " + e.getMessage());
        }

        String msg = String.format("Importação concluída: %d novo(s) cliente(s) cadastrado(s), %d atualizado(s).",
                ctx.clientsCreated, ctx.clientsUpdated);

        return new XmlClientImportResult(
                ctx.filesProcessed,
                ctx.clientsCreated,
                ctx.clientsUpdated,
                ctx.pricesUpdated,
                ctx.importedNames,
                ctx.warnings,
                msg
        );
    }

    private ImportContext initContext() {
        ImportContext ctx = new ImportContext();

        // Carrega produtos do TotalTrigo para indexação de códigos
        ctx.allProducts = productRepository.findAllByOrderByIdAsc();
        for (Product p : ctx.allProducts) {
            ctx.productBySkuCode.put(p.getSkuCode().toUpperCase(), p);
            if (p.getSkuCode().endsWith("-05")) ctx.productBySkuCode.put("05", p);
            if (p.getSkuCode().endsWith("-02")) ctx.productBySkuCode.put("02", p);
            if (p.getSkuCode().endsWith("-03")) ctx.productBySkuCode.put("03", p);
            if (p.getErpCode() != null && !p.getErpCode().isBlank()) {
                ctx.productBySkuCode.put(p.getErpCode().trim(), p);
            }
        }

        // Indexa clientes existentes pelos dígitos limpos do CNPJ/CPF
        for (Client c : clientRepository.findAll()) {
            if (c.getCnpj() != null) {
                String clean = c.getCnpj().replaceAll("\\D", "");
                if (!clean.isEmpty()) {
                    ctx.clientByCleanDoc.put(clean, c);
                }
            }
        }

        return ctx;
    }

    private void processZipStream(InputStream in, String zipFilename, ImportContext ctx) {
        try (ZipInputStream zis = new ZipInputStream(in)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String entryName = entry.getName();
                if (entryName.toLowerCase().endsWith(".xml")) {
                    byte[] bytes = zis.readAllBytes();
                    processXmlBytes(bytes, zipFilename + "/" + entryName, ctx);
                }
                zis.closeEntry();
            }
        } catch (Exception e) {
            log.warn("Erro ao ler arquivo ZIP {}: {}", zipFilename, e.getMessage());
            ctx.warnings.add("Falha ao descompactar " + zipFilename + ": " + e.getMessage());
        }
    }

    private void processXmlBytes(byte[] xmlBytes, String filename, ImportContext ctx) {
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(false);
            // Proteção contra XML External Entity (XXE)
            try {
                dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            } catch (Exception ignored) {}

            DocumentBuilder db = dbf.newDocumentBuilder();
            Document doc = db.parse(new ByteArrayInputStream(xmlBytes));
            doc.getDocumentElement().normalize();

            Element root = doc.getDocumentElement();
            String rootTag = root.getTagName().toLowerCase();

            // Detecta tipo de XML
            if (rootTag.contains("nfeproc") || rootTag.contains("nfe") || root.getElementsByTagName("infNFe").getLength() > 0) {
                // Formato NF-e SEFAZ
                processNfeXml(root, filename, ctx);
            } else {
                // Formato genérico de clientes ou lista de cadastros
                processGenericClientXml(root, filename, ctx);
            }

            ctx.filesProcessed++;
        } catch (Exception e) {
            log.warn("Falha no parsing XML de {}: {}", filename, e.getMessage());
            ctx.warnings.add("Falha no XML " + filename + ": " + e.getMessage());
        }
    }

    /**
     * Processa XML no padrão oficial de NF-e (tags dest, enderDest, det/prod).
     */
    private void processNfeXml(Element root, String filename, ImportContext ctx) {
        Element dest = findFirstElement(root, "dest");
        if (dest == null) {
            ctx.warnings.add("Nenhum elemento <dest> encontrado no arquivo " + filename);
            return;
        }

        String rawDoc = getFirstText(dest, "CNPJ", "CPF");
        if (rawDoc == null || rawDoc.isBlank()) {
            ctx.warnings.add("Cliente sem CNPJ/CPF em " + filename);
            return;
        }
        String cleanDoc = rawDoc.replaceAll("\\D", "");
        if (cleanDoc.isEmpty()) return;

        String xNome = getFirstText(dest, "xNome", "nome");
        String ie = getFirstText(dest, "IE", "ie");
        String indIeDest = getFirstText(dest, "indIEDest");

        Element enderDest = findFirstElement(dest, "enderDest");
        String xLgr = enderDest != null ? getFirstText(enderDest, "xLgr", "logradouro") : null;
        String nro = enderDest != null ? getFirstText(enderDest, "nro", "numero") : null;
        String xCpl = enderDest != null ? getFirstText(enderDest, "xCpl", "complemento") : null;
        String xBairro = enderDest != null ? getFirstText(enderDest, "xBairro", "bairro") : null;
        String cMun = enderDest != null ? getFirstText(enderDest, "cMun", "codigoIbge") : null;
        String xMun = enderDest != null ? getFirstText(enderDest, "xMun", "municipio", "cidade") : null;
        String uf = enderDest != null ? getFirstText(enderDest, "UF", "uf", "estado") : null;
        String cep = enderDest != null ? getFirstText(enderDest, "CEP", "cep") : null;
        String fone = enderDest != null ? getFirstText(enderDest, "fone", "telefone") : null;

        Element ide = findFirstElement(root, "ide");
        LocalDate emissionDate = parseEmissionDate(ide != null ? getFirstText(ide, "dhEmi") : null);
        Element totalEl = findFirstElement(root, "ICMSTot");
        BigDecimal vNf = parseDecimal(totalEl != null ? getFirstText(totalEl, "vNF") : null);

        Client client = upsertClient(
                cleanDoc, xNome, null, ie, indIeDest,
                xLgr, nro, xCpl, xBairro, cMun, xMun, uf, cep, fone,
                null, null, null, emissionDate, vNf, ctx
        );

        // Preços dos itens da NF-e
        NodeList detNodes = root.getElementsByTagName("det");
        for (int i = 0; i < detNodes.getLength(); i++) {
            if (!(detNodes.item(i) instanceof Element detEl)) continue;
            Element prodEl = findFirstElement(detEl, "prod");
            if (prodEl == null) continue;

            String cProd = getFirstText(prodEl, "cProd", "codigo");
            String vUnComStr = getFirstText(prodEl, "vUnCom", "valorUnitario");
            if (cProd == null || vUnComStr == null) continue;

            Product matchedProduct = resolveProductByCode(cProd.trim(), ctx.productBySkuCode);
            BigDecimal vUnCom = parseDecimal(vUnComStr);
            if (matchedProduct != null && vUnCom != null && vUnCom.compareTo(BigDecimal.ZERO) > 0) {
                updateClientPrice(client, matchedProduct, vUnCom, emissionDate, ctx);
            }
        }
    }

    /**
     * Processa XML genérico contendo lista de clientes (<clientes><cliente>...) ou dados avulsos.
     */
    private void processGenericClientXml(Element root, String filename, ImportContext ctx) {
        List<Element> clientElements = new ArrayList<>();

        // Procura tags filhas que representam registros de cliente
        String[] possibleTags = {"cliente", "destinatario", "registro", "dest", "empresa", "cadastro", "item"};
        for (String tag : possibleTags) {
            NodeList list = root.getElementsByTagName(tag);
            for (int i = 0; i < list.getLength(); i++) {
                if (list.item(i) instanceof Element el) {
                    clientElements.add(el);
                }
            }
            if (!clientElements.isEmpty()) break;
        }

        // Se nenhuma tag interna foi encontrada, talvez o próprio root seja o cliente
        if (clientElements.isEmpty()) {
            if (hasClientFields(root)) {
                clientElements.add(root);
            }
        }

        if (clientElements.isEmpty()) {
            ctx.warnings.add("Nenhum registro de cliente identificado na estrutura do XML " + filename);
            return;
        }

        for (Element cEl : clientElements) {
            String rawDoc = getFirstText(cEl, "CNPJ", "CPF", "cnpj", "cpf", "documento", "doc", "cpfCnpj", "cnpjCpf");
            if (rawDoc == null || rawDoc.isBlank()) continue;
            String cleanDoc = rawDoc.replaceAll("\\D", "");
            if (cleanDoc.isEmpty()) continue;

            String corporateName = getFirstText(cEl, "razaoSocial", "razao_social", "xNome", "nome", "nomeCliente", "nome_completo", "empresa");
            String tradeName = getFirstText(cEl, "nomeFantasia", "nome_fantasia", "xFant", "fantasia", "apelido");
            String ie = getFirstText(cEl, "IE", "ie", "inscricaoEstadual", "inscricao_estadual", "inscricao");
            String indIe = getFirstText(cEl, "indIEDest", "indicadorIE", "indIe");

            Element ender = findFirstElement(cEl, "enderDest", "endereco", "dadosEndereco");
            Element targetAddr = ender != null ? ender : cEl;

            String street = getFirstText(targetAddr, "xLgr", "logradouro", "endereco", "rua", "logr");
            String number = getFirstText(targetAddr, "nro", "numero", "num");
            String complement = getFirstText(targetAddr, "xCpl", "complemento", "compl");
            String neighborhood = getFirstText(targetAddr, "xBairro", "bairro", "bair");
            String city = getFirstText(targetAddr, "xMun", "cidade", "municipio", "nomeMunicipio");
            String state = getFirstText(targetAddr, "UF", "uf", "estado", "siglaUf");
            String zipCode = getFirstText(targetAddr, "CEP", "cep", "codigoPostal");
            String ibge = getFirstText(targetAddr, "cMun", "ibge", "codigoIbge", "codigo_ibge", "cMunIBGE");
            String phone = getFirstText(targetAddr, "fone", "telefone", "celular", "tel", "whatsapp");

            String contact = getFirstText(cEl, "contato", "comprador", "responsavel", "nomeContato");
            String paymentTerms = getFirstText(cEl, "condicaoPagamento", "formaPagamento", "prazo", "condicao");
            Integer cycle = parseInteger(getFirstText(cEl, "ciclo", "diasCiclo", "frequencia", "cicloDias"));

            upsertClient(
                    cleanDoc, corporateName, tradeName, ie, indIe,
                    street, number, complement, neighborhood, ibge, city, state, zipCode, phone,
                    contact, paymentTerms, cycle, null, null, ctx
            );
        }
    }

    private boolean hasClientFields(Element el) {
        return getFirstText(el, "CNPJ", "CPF", "cnpj", "cpf", "documento") != null ||
                getFirstText(el, "razaoSocial", "xNome", "nome") != null;
    }

    private Client upsertClient(
            String cleanDoc,
            String corporateName,
            String tradeName,
            String ie,
            String indIeDest,
            String street,
            String number,
            String complement,
            String neighborhood,
            String ibgeCityCode,
            String city,
            String state,
            String zipCode,
            String phone,
            String contactName,
            String paymentTerms,
            Integer cycleDays,
            LocalDate emissionDate,
            BigDecimal vNf,
            ImportContext ctx
    ) {
        Client client = ctx.clientByCleanDoc.get(cleanDoc);
        boolean isNew = false;

        if (client == null) {
            client = new Client();
            client.setCnpj(formatDocument(cleanDoc));
            client.setCorporateName(corporateName != null && !corporateName.isBlank()
                    ? corporateName.trim()
                    : "CLIENTE " + cleanDoc);
            client.setTradeName(tradeName != null && !tradeName.isBlank()
                    ? tradeName.trim()
                    : simplifyTradeName(client.getCorporateName()));
            client.setDefaultPaymentTerms(paymentTerms != null && !paymentTerms.isBlank()
                    ? paymentTerms.trim()
                    : "Boleto 28 dias");
            client.setAveragePurchaseCycleDays(cycleDays != null && cycleDays > 0 ? cycleDays : 20);
            client.setFinancialStatus(FinancialStatus.EM_DIA);
            client.setPurchaseProfile(PurchaseProfile.INDUSTRIALIZACAO);
            client.setContactName(contactName != null && !contactName.isBlank() ? contactName.trim() : "Comprador");
            client.setCity(city != null && !city.isBlank() ? city.trim() : "São Paulo");
            client.setState(state != null && !state.isBlank() ? state.trim() : "SP");
            isNew = true;
        } else {
            // Atualiza campos caso o cliente já exista
            if (corporateName != null && !corporateName.isBlank() && client.getCorporateName().startsWith("CLIENTE ")) {
                client.setCorporateName(corporateName.trim());
            }
            if (tradeName != null && !tradeName.isBlank() && (client.getTradeName() == null || client.getTradeName().isBlank())) {
                client.setTradeName(tradeName.trim());
            }
            if (contactName != null && !contactName.isBlank() && (client.getContactName() == null || client.getContactName().equals("Comprador"))) {
                client.setContactName(contactName.trim());
            }
            if (paymentTerms != null && !paymentTerms.isBlank()) {
                client.setDefaultPaymentTerms(paymentTerms.trim());
            }
            if (cycleDays != null && cycleDays > 0) {
                client.setAveragePurchaseCycleDays(cycleDays);
            }
        }

        // IE e Indicador
        if (ie != null && !ie.isBlank()) {
            client.setStateRegistration(ie.trim());
        }
        if ("2".equals(indIeDest) || "ISENTO".equalsIgnoreCase(ie)) {
            client.setIeIndicator(IeIndicator.ISENTO);
        } else if ("9".equals(indIeDest)) {
            client.setIeIndicator(IeIndicator.NAO_CONTRIBUINTE);
        } else if (client.getIeIndicator() == null) {
            client.setIeIndicator(IeIndicator.CONTRIBUINTE);
        }

        // Endereço
        if (street != null && !street.isBlank()) client.setStreet(street.trim());
        if (number != null && !number.isBlank()) client.setNumber(number.trim());
        if (complement != null && !complement.isBlank()) client.setComplement(complement.trim());
        if (neighborhood != null && !neighborhood.isBlank()) client.setNeighborhood(neighborhood.trim());
        if (city != null && !city.isBlank()) client.setCity(city.trim());
        if (state != null && !state.isBlank()) client.setState(state.trim());
        if (zipCode != null && !zipCode.isBlank()) client.setZipCode(formatCep(zipCode.trim()));
        if (ibgeCityCode != null && !ibgeCityCode.isBlank()) client.setIbgeCityCode(ibgeCityCode.trim());
        if (phone != null && !phone.isBlank() && (client.getPhone() == null || client.getPhone().isBlank())) {
            client.setPhone(phone.trim());
        }

        // Histórico de compras
        if (vNf != null && vNf.compareTo(BigDecimal.ZERO) > 0) {
            client.setLastOrderTotal(vNf);
        }
        if (emissionDate != null && (client.getLastPurchaseDate() == null || emissionDate.isAfter(client.getLastPurchaseDate()))) {
            client.setLastPurchaseDate(emissionDate);
        }

        // Validação de cadastro completo
        boolean hasValidDoc = cleanDoc.length() >= 11;
        boolean hasValidAddress = client.getStreet() != null && !client.getStreet().isBlank();
        boolean hasValidIbge = client.getIbgeCityCode() != null && client.getIbgeCityCode().trim().length() == 7;
        client.setRegistrationComplete(hasValidDoc && hasValidAddress && hasValidIbge);

        client = clientRepository.save(client);
        ctx.clientByCleanDoc.put(cleanDoc, client);

        if (isNew) {
            ctx.clientsCreated++;
            ctx.importedNames.add(client.getTradeName() != null ? client.getTradeName() : client.getCorporateName());
        } else {
            ctx.clientsUpdated++;
        }

        // Garante tabela de preços base para os 3 SKUs oficiais
        for (Product p : ctx.allProducts) {
            final Client finalClient = client;
            clientSkuPriceRepository.findByClientIdAndProductId(finalClient.getId(), p.getId())
                    .orElseGet(() -> {
                        ClientSkuPrice baseCsp = new ClientSkuPrice();
                        baseCsp.setClient(finalClient);
                        baseCsp.setProduct(p);
                        baseCsp.setLastPracticedPrice(p.getBaseListPrice());
                        baseCsp.setAgreedStandardPrice(p.getBaseListPrice());
                        baseCsp.setLastOrderDate(emissionDate != null ? emissionDate : LocalDate.now().minusDays(15));
                        return clientSkuPriceRepository.save(baseCsp);
                    });
        }

        return client;
    }

    private void updateClientPrice(Client client, Product product, BigDecimal price, LocalDate date, ImportContext ctx) {
        ClientSkuPrice csp = clientSkuPriceRepository
                .findByClientIdAndProductId(client.getId(), product.getId())
                .orElseGet(() -> {
                    ClientSkuPrice n = new ClientSkuPrice();
                    n.setClient(client);
                    n.setProduct(product);
                    return n;
                });

        csp.setLastPracticedPrice(price);
        csp.setAgreedStandardPrice(price);
        if (date != null) {
            csp.setLastOrderDate(date);
        }
        clientSkuPriceRepository.save(csp);
        ctx.pricesUpdated++;
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

    private static Element findFirstElement(Element parent, String... tagNames) {
        for (String tag : tagNames) {
            NodeList list = parent.getElementsByTagName(tag);
            if (list.getLength() > 0 && list.item(0) instanceof Element el) {
                return el;
            }
        }
        return null;
    }

    private static String getFirstText(Element parent, String... tagNames) {
        for (String tag : tagNames) {
            NodeList list = parent.getElementsByTagName(tag);
            if (list.getLength() > 0 && list.item(0) instanceof Element el) {
                String text = el.getTextContent();
                if (text != null && !text.isBlank()) {
                    return text.trim();
                }
            }
        }
        return null;
    }

    private static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return new BigDecimal(raw.trim()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer parseInteger(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Integer.parseInt(raw.trim());
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
                } catch (Exception ignored) {}
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
        if (digits.length() == 11) {
            return String.format("%s.%s.%s-%s",
                    digits.substring(0, 3),
                    digits.substring(3, 6),
                    digits.substring(6, 9),
                    digits.substring(9, 11));
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
