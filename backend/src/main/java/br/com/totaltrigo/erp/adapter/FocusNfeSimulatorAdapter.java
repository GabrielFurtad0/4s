package br.com.totaltrigo.erp.adapter;

import br.com.totaltrigo.erp.domain.enums.IeIndicator;
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

    public String buildTotalTrigoNfeXml(Order order, String nNF, String cNF, String cDV, String chNFe, String nProt) {
        Client c = order.getClient();
        String dhEmi = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        String cleanDoc = c.getCnpj() != null ? c.getCnpj().replaceAll("\\D", "") : "";
        String docTag = cleanDoc.length() == 11
                ? "<CPF>" + cleanDoc + "</CPF>"
                : "<CNPJ>" + cleanDoc + "</CNPJ>";

        boolean isInternal = c.getState() == null || "SP".equalsIgnoreCase(c.getState().trim());
        String idDest = isInternal ? "1" : "2";

        // Destinatário IE e indIEDest:
        // 1 se tiver IE numérica válida e não for ISENTO, 2 se ISENTO, 9 se não contribuinte/CPF
        String rawIe = c.getStateRegistration() != null ? c.getStateRegistration().trim() : "";
        String cleanIe = rawIe.replaceAll("\\D", "");

        String indIEDest;
        boolean isCpf = cleanDoc.length() == 11;
        boolean isIsento = "ISENTO".equalsIgnoreCase(rawIe) || c.getIeIndicator() == IeIndicator.ISENTO;
        boolean hasNumericIe = !cleanIe.isEmpty() && !"ISENTO".equalsIgnoreCase(rawIe);

        if (isIsento) {
            indIEDest = "2";
        } else if (hasNumericIe && !isCpf && c.getIeIndicator() != IeIndicator.NAO_CONTRIBUINTE) {
            indIEDest = "1";
        } else if (hasNumericIe && c.getIeIndicator() == IeIndicator.CONTRIBUINTE) {
            indIEDest = "1";
        } else {
            indIEDest = "9";
        }

        String ieXml = "1".equals(indIEDest) ? "<IE>" + cleanIe + "</IE>" : "";

        BigDecimal totalVProd = BigDecimal.ZERO;
        BigDecimal totalVBC = BigDecimal.ZERO;
        BigDecimal totalVICMS = BigDecimal.ZERO;

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

            String cfop = isInternal ? p.getDefaultCfopInternal() : p.getDefaultCfopInterstate();

            // Redução de base de cálculo (Art. 3º Anexo III do RICMS/SP - Farinha de Trigo):
            // Carga tributária efetiva de 7.00% com alíquota nominal de 12.00% -> Base = 58.33% do vProd
            BigDecimal vBC = vProd.multiply(new BigDecimal("0.5833")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal vICMS = vBC.multiply(new BigDecimal("0.12")).setScale(2, RoundingMode.HALF_UP);

            totalVProd = totalVProd.add(vProd);
            totalVBC = totalVBC.add(vBC);
            totalVICMS = totalVICMS.add(vICMS);

            detBuilder.append("<det nItem=\"").append(itemIdx++).append("\">")
                    .append("<prod>")
                    .append("<cProd>").append(escapeXml(p.getErpCode())).append("</cProd>")
                    .append("<cEAN/>")
                    .append("<xProd>").append(escapeXml(p.getName())).append("</xProd>")
                    .append("<NCM>").append(p.getNcm()).append("</NCM>")
                    .append("<CFOP>").append(cfop).append("</CFOP>")
                    .append("<uCom>SACAS</uCom>")
                    .append("<qCom>").append(qCom).append("</qCom>")
                    .append("<vUnCom>").append(vUnCom).append("</vUnCom>")
                    .append("<vProd>").append(vProd).append("</vProd>")
                    .append("<cEANTrib/>")
                    .append("<uTrib>SACAS</uTrib>")
                    .append("<qTrib>").append(qCom).append("</qTrib>")
                    .append("<vUnTrib>").append(vUnCom).append("</vUnTrib>")
                    .append("<indTot>1</indTot>")
                    .append("</prod>")
                    .append("<imposto>")
                    .append("<ICMS>")
                    .append("<ICMS20>")
                    .append("<orig>0</orig>")
                    .append("<CST>20</CST>")
                    .append("<modBC>3</modBC>")
                    .append("<pRedBC>58.33</pRedBC>")
                    .append("<vBC>").append(vBC).append("</vBC>")
                    .append("<pICMS>12.0000</pICMS>")
                    .append("<vICMS>").append(vICMS).append("</vICMS>")
                    .append("</ICMS20>")
                    .append("</ICMS>")
                    .append("<PIS><PISNT><CST>09</CST></PISNT></PIS>")
                    .append("<COFINS><COFINSNT><CST>09</CST></COFINSNT></COFINS>")
                    .append("</imposto>")
                    .append("</det>");
        }

        String notes = order.getNotesForInvoiceOrDriver();
        String infCpl = "REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS" +
                (notes != null && !notes.trim().isEmpty() ? " - " + notes.trim() : "");

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
                "<nfeProc versao=\"4.00\" xmlns=\"http://www.portalfiscal.inf.br/nfe\">" +
                "<NFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">" +
                "<infNFe Id=\"NFe" + chNFe + "\" versao=\"4.00\">" +
                "<ide>" +
                "<cUF>35</cUF>" +
                "<cNF>" + cNF + "</cNF>" +
                "<natOp>VENDA</natOp>" +
                "<mod>55</mod>" +
                "<serie>1</serie>" +
                "<nNF>" + nNF + "</nNF>" +
                "<dhEmi>" + dhEmi + "</dhEmi>" +
                "<tpNF>1</tpNF>" +
                "<idDest>" + idDest + "</idDest>" +
                "<cMunFG>3550308</cMunFG>" +
                "<tpImp>1</tpImp>" +
                "<tpEmis>1</tpEmis>" +
                "<cDV>" + cDV + "</cDV>" +
                "<tpAmb>2</tpAmb>" +
                "<finNFe>1</finNFe>" +
                "<indFinal>1</indFinal>" +
                "<indPres>0</indPres>" +
                "<procEmi>0</procEmi>" +
                "<verProc>4S-ERP-1.0</verProc>" +
                "</ide>" +
                "<emit>" +
                "<CNPJ>09265201000195</CNPJ>" +
                "<xNome>TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA</xNome>" +
                "<xFant>TOTAL TRIGO</xFant>" +
                "<enderEmit>" +
                "<xLgr>Rua Marco Aurelio Marliani</xLgr>" +
                "<nro>59</nro>" +
                "<xCpl>SUBSL</xCpl>" +
                "<xBairro>Jardim Almeida Prado</xBairro>" +
                "<cMun>3550308</cMun>" +
                "<xMun>Sao Paulo</xMun>" +
                "<UF>SP</UF>" +
                "<CEP>04854170</CEP>" +
                "<cPais>1058</cPais>" +
                "<xPais>BRASIL</xPais>" +
                "</enderEmit>" +
                "<IE>149932895118</IE>" +
                "<IM>59829524</IM>" +
                "<CNAE>4691500</CNAE>" +
                "<CRT>3</CRT>" +
                "</emit>" +
                "<dest>" +
                docTag +
                "<xNome>" + escapeXml(c.getCorporateName()) + "</xNome>" +
                "<enderDest>" +
                "<xLgr>" + escapeXml(c.getStreet() != null ? c.getStreet() : "") + "</xLgr>" +
                "<nro>" + escapeXml(c.getNumber() != null ? c.getNumber() : "S/N") + "</nro>" +
                (c.getComplement() != null && !c.getComplement().trim().isEmpty() ? "<xCpl>" + escapeXml(c.getComplement().trim()) + "</xCpl>" : "") +
                "<xBairro>" + escapeXml(c.getNeighborhood() != null ? c.getNeighborhood() : "") + "</xBairro>" +
                "<cMun>" + c.getIbgeCityCode() + "</cMun>" +
                "<xMun>" + escapeXml(c.getCity() != null ? c.getCity() : "Sao Paulo") + "</xMun>" +
                "<UF>" + (c.getState() != null ? c.getState() : "SP") + "</UF>" +
                "<CEP>" + (c.getZipCode() != null ? c.getZipCode().replaceAll("\\D", "") : "04000000") + "</CEP>" +
                "<cPais>1058</cPais>" +
                "<xPais>BRASIL</xPais>" +
                "</enderDest>" +
                "<indIEDest>" + indIEDest + "</indIEDest>" +
                ieXml +
                "</dest>" +
                detBuilder +
                "<total>" +
                "<ICMSTot>" +
                "<vBC>" + totalVBC.setScale(2, RoundingMode.HALF_UP) + "</vBC>" +
                "<vICMS>" + totalVICMS.setScale(2, RoundingMode.HALF_UP) + "</vICMS>" +
                "<vICMSDeson>0.00</vICMSDeson>" +
                "<vFCP>0.00</vFCP>" +
                "<vBCST>0.00</vBCST>" +
                "<vST>0.00</vST>" +
                "<vFCPST>0.00</vFCPST>" +
                "<vFCPSTRet>0.00</vFCPSTRet>" +
                "<vProd>" + totalVProd.setScale(2, RoundingMode.HALF_UP) + "</vProd>" +
                "<vFrete>0.00</vFrete>" +
                "<vSeg>0.00</vSeg>" +
                "<vDesc>0.00</vDesc>" +
                "<vII>0.00</vII>" +
                "<vIPI>0.00</vIPI>" +
                "<vIPIDevol>0.00</vIPIDevol>" +
                "<vPIS>0.00</vPIS>" +
                "<vCOFINS>0.00</vCOFINS>" +
                "<vOutro>0.00</vOutro>" +
                "<vNF>" + totalVProd.setScale(2, RoundingMode.HALF_UP) + "</vNF>" +
                "<vTotTrib>0.00</vTotTrib>" +
                "</ICMSTot>" +
                "</total>" +
                "<transp><modFrete>0</modFrete></transp>" +
                "<pag><detPag><indPag>1</indPag><tPag>15</tPag><vPag>" + totalVProd.setScale(2, RoundingMode.HALF_UP) + "</vPag></detPag></pag>" +
                "<infAdic><infCpl>" + escapeXml(infCpl) + "</infCpl></infAdic>" +
                "</infNFe></NFe>" +
                "<protNFe versao=\"4.00\" xmlns=\"http://www.portalfiscal.inf.br/nfe\"><infProt>" +
                "<chNFe>" + chNFe + "</chNFe><nProt>" + nProt + "</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo>" +
                "</infProt></protNFe></nfeProc>";
    }

    private String escapeXml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
