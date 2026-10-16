package br.com.totaltrigo.erp.adapter;

import br.com.totaltrigo.erp.domain.model.Client;
import br.com.totaltrigo.erp.domain.model.Order;
import br.com.totaltrigo.erp.domain.model.OrderItem;
import br.com.totaltrigo.erp.domain.model.Product;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Adapter para emissão de NF-e (Padrão Focus NFe / Nuvem Fiscal).
 * Gera Chave de Acesso de 44 dígitos e XML NF-e 4.00 fiel ao layout SEFAZ-SP da Total Trigo.
 */
@Component
public class FocusNfeSimulatorAdapter implements NfeGatewayPort {

    private static final AtomicInteger SEQUENCE_NF = new AtomicInteger(12935);

    @Override
    public NfeEmissionResult emitNfe(Order order) {
        Client client = order.getClient();
        String cleanCnpj = client.getCnpj() != null ? client.getCnpj().replaceAll("\\D", "") : "";
        if (cleanCnpj.length() < 11) {
            return new NfeEmissionResult(
                    false,
                    null,
                    null,
                    null,
                    "Rejeição 207: CNPJ/CPF do destinatário inválido ou ausente.",
                    null
            );
        }
        if (client.getIbgeCityCode() == null || client.getIbgeCityCode().trim().length() != 7) {
            return new NfeEmissionResult(
                    false,
                    null,
                    null,
                    null,
                    "Rejeição 270: Código de Município do IBGE (7 dígitos) obrigatório para emissão na SEFAZ.",
                    null
            );
        }

        int nfeNum = SEQUENCE_NF.incrementAndGet();
        String nfeNumberStr = String.valueOf(nfeNum);
        String paddedNf = String.format("%09d", nfeNum);
        String cNf = String.format("%08d", 30000000 + nfeNum);

        // Chave de 44 dígitos: 35 (SP) + 2610 (AAMM) + 09265201000195 (CNPJ Total Trigo) + 55 + 001 + nNF(9) + 1 + cNF(8) + DV(1)
        String baseKey = "3526100926520100019555001" + paddedNf + "1" + cNf;
        int dv = calculateMod11(baseKey);
        String accessKey = baseKey + dv;
        String protocol = "135264" + (200000000 + nfeNum);

        String xml = buildTotalTrigoNfeXml(order, nfeNumberStr, cNf, String.valueOf(dv), accessKey, protocol);

        return new NfeEmissionResult(
                true,
                nfeNumberStr,
                accessKey,
                protocol,
                "100 - Autorizado o uso da NF-e (SEFAZ-SP / Focus NFe Adapter)",
                xml
        );
    }

    private int calculateMod11(String key43) {
        int sum = 0;
        int weight = 2;
        for (int i = key43.length() - 1; i >= 0; i--) {
            sum += (key43.charAt(i) - '0') * weight;
            weight = (weight == 9) ? 2 : weight + 1;
        }
        int mod = sum % 11;
        return (mod == 0 || mod == 1) ? 0 : (11 - mod);
    }

    private String buildTotalTrigoNfeXml(Order order, String nNF, String cNF, String cDV, String chNFe, String nProt) {
        Client c = order.getClient();
        String dhEmi = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        String cleanDoc = c.getCnpj() != null ? c.getCnpj().replaceAll("\\D", "") : "";
        String docTag = cleanDoc.length() == 11
                ? "<CPF>" + cleanDoc + "</CPF>"
                : "<CNPJ>" + cleanDoc + "</CNPJ>";

        StringBuilder detBuilder = new StringBuilder();
        int itemIdx = 1;
        for (OrderItem item : order.getItems()) {
            if (item.getQuantity() == null || item.getQuantity() <= 0) continue;
            Product p = item.getProduct();
            BigDecimal qCom = new BigDecimal(item.getQuantity()).setScale(4, RoundingMode.HALF_UP);
            BigDecimal vUnCom = item.getUnitSalePrice().setScale(4, RoundingMode.HALF_UP);
            BigDecimal vProd = item.getUnitSalePrice()
                    .multiply(new BigDecimal(item.getQuantity()))
                    .setScale(2, RoundingMode.HALF_UP);

            String cfop = "SP".equalsIgnoreCase(c.getState()) ? p.getDefaultCfopInternal() : p.getDefaultCfopInterstate();

            detBuilder.append("<det nItem=\"").append(itemIdx++).append("\">")
                    .append("<prod>")
                    .append("<cProd>").append(p.getErpCode()).append("</cProd>")
                    .append("<cEAN>SEM GTIN</cEAN>")
                    .append("<xProd>").append(p.getName()).append("</xProd>")
                    .append("<NCM>").append(p.getNcm()).append("</NCM>")
                    .append("<cBenef>").append(p.getcBenef() != null ? p.getcBenef() : "SP020390").append("</cBenef>")
                    .append("<CFOP>").append(cfop).append("</CFOP>")
                    .append("<uCom>").append(p.getUnitOfMeasure()).append("</uCom>")
                    .append("<qCom>").append(qCom).append("</qCom>")
                    .append("<vUnCom>").append(vUnCom).append("</vUnCom>")
                    .append("<vProd>").append(vProd).append("</vProd>")
                    .append("<uTrib>").append(p.getUnitOfMeasure()).append("</uTrib>")
                    .append("<qTrib>").append(qCom).append("</qTrib>")
                    .append("<vUnTrib>").append(vUnCom).append("</vUnTrib>")
                    .append("<indTot>1</indTot>")
                    .append("</prod>")
                    .append("</det>");
        }

        BigDecimal vNF = order.getGrossTotal().setScale(2, RoundingMode.HALF_UP);

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
                "<nfeProc versao=\"4.00\" xmlns=\"http://www.portalfiscal.inf.br/nfe\">" +
                "<NFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">" +
                "<infNFe Id=\"NFe" + chNFe + "\" versao=\"4.00\">" +
                "<ide><cUF>35</cUF><cNF>" + cNF + "</cNF><natOp>Venda Dentro do Estado</natOp><mod>55</mod><serie>1</serie>" +
                "<nNF>" + nNF + "</nNF><dhEmi>" + dhEmi + "</dhEmi><tpNF>1</tpNF><cMunFG>3550308</cMunFG><cDV>" + cDV + "</cDV></ide>" +
                "<emit><CNPJ>09265201000195</CNPJ><xNome>TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA</xNome>" +
                "<enderEmit><xLgr>Rua Marco Aurelio Marliani</xLgr><nro>59</nro><xBairro>Jardim Almeida Prado</xBairro>" +
                "<cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>04854170</CEP></enderEmit><IE>149932895118</IE><CRT>3</CRT></emit>" +
                "<dest>" + docTag + "<xNome>" + c.getCorporateName() + "</xNome>" +
                "<enderDest><xLgr>" + (c.getStreet() != null ? c.getStreet() : "") + "</xLgr>" +
                "<nro>" + (c.getNumber() != null ? c.getNumber() : "S/N") + "</nro>" +
                "<xBairro>" + (c.getNeighborhood() != null ? c.getNeighborhood() : "") + "</xBairro>" +
                "<cMun>" + c.getIbgeCityCode() + "</cMun><xMun>" + (c.getCity() != null ? c.getCity() : "Sao Paulo") + "</xMun>" +
                "<UF>" + (c.getState() != null ? c.getState() : "SP") + "</UF>" +
                "<CEP>" + (c.getZipCode() != null ? c.getZipCode().replaceAll("\\D", "") : "04000000") + "</CEP></enderDest>" +
                "<IE>" + (c.getStateRegistration() != null ? c.getStateRegistration() : "ISENTO") + "</IE></dest>" +
                detBuilder +
                "<total><ICMSTot><vProd>" + vNF + "</vProd><vNF>" + vNF + "</vNF></ICMSTot></total>" +
                "<infAdic><infCpl>REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS - " +
                (order.getNotesForInvoiceOrDriver() != null ? order.getNotesForInvoiceOrDriver() : "") + "</infCpl></infAdic>" +
                "</infNFe></NFe>" +
                "<protNFe versao=\"4.00\" xmlns=\"http://www.portalfiscal.inf.br/nfe\"><infProt>" +
                "<chNFe>" + chNFe + "</chNFe><nProt>" + nProt + "</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo>" +
                "</infProt></protNFe></nfeProc>";
    }
}
