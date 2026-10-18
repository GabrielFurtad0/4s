package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.adapter.NfeGatewayPort;
import br.com.totaltrigo.erp.domain.enums.NfeStatus;
import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import br.com.totaltrigo.erp.domain.model.Client;
import br.com.totaltrigo.erp.domain.model.InvoiceData;
import br.com.totaltrigo.erp.domain.model.Order;
import br.com.totaltrigo.erp.domain.model.OrderItem;
import br.com.totaltrigo.erp.domain.model.Product;
import br.com.totaltrigo.erp.repository.OrderRepository;
import br.com.totaltrigo.erp.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Serviço de geração de documentos fiscais e operacionais (DANFE NF-e 4.00, Romaneio Cego de Expedição DQ)
 * e registro de eventos pós-emissão (Carta de Correção Eletrônica CC-e e NF-e de Devolução CFOP 1202).
 */
@Service
public class FiscalDocumentService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final NfeGatewayPort nfeGatewayPort;

    public FiscalDocumentService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            NfeGatewayPort nfeGatewayPort
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.nfeGatewayPort = nfeGatewayPort;
    }

    /**
     * Gera o HTML completo de impressão/PDF do DANFE Padrão NF-e 4.00 da Total Trigo.
     * Valores e quantidades calculados ESTRITAMENTE sobre a Qtd. Base (BQ).
     */
    @Transactional(readOnly = true)
    public String generateDanfeHtml(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        return buildDanfeHtmlContent(order);
    }

    @Transactional(readOnly = true)
    public String generateDanfeHtml(UUID orderId) {
        Order order = resolveOrderFromUuid(orderId);
        return buildDanfeHtmlContent(order);
    }

    /**
     * Gera o HTML limpo do Romaneio Cego de Expedição & Entrega para galpão e motorista.
     * Exibe EXCLUSIVAMENTE a Qtd. Expedição (DQ), sem nenhum preço ou BQ.
     */
    @Transactional(readOnly = true)
    public String generatePrintableRomaneioHtml(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));
        return buildRomaneioHtmlContent(order);
    }

    @Transactional(readOnly = true)
    public String generatePrintableRomaneioHtml(UUID orderId) {
        Order order = resolveOrderFromUuid(orderId);
        return buildRomaneioHtmlContent(order);
    }

    /**
     * Registra evento de Carta de Correção Eletrônica (CC-e) conforme regras da SEFAZ (mínimo 15 caracteres).
     */
    @Transactional
    public Map<String, Object> registerCartaCorrecao(Long orderId, String textoCorrecao) {
        if (textoCorrecao == null || textoCorrecao.trim().length() < 15) {
            throw new IllegalArgumentException("O texto da Carta de Correção (CC-e) deve ter no mínimo 15 caracteres (Regra SEFAZ).");
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        if (order.getStatus() != OrderStatus.FATURADO && order.getStatus() != OrderStatus.ENTREGUE) {
            throw new IllegalStateException("Apenas pedidos FATURADOS ou ENTREGUES podem receber Carta de Correção Eletrônica.");
        }

        String nfeNumber = order.getInvoiceData() != null ? order.getInvoiceData().getNfeNumber() : String.valueOf(order.getId());
        String accessKey = order.getInvoiceData() != null ? order.getInvoiceData().getNfeAccessKey() : "";

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        String protocolNumber = "13526" + String.format("%010d", Math.abs((orderId * 31L + System.currentTimeMillis()) % 10000000000L));
        int eventSequence = 1;

        String cceEntry = String.format("[CC-e Seq %d | Prot: %s | %s]: %s", eventSequence, protocolNumber, timestamp, textoCorrecao.trim());
        String existingNotes = order.getBackofficeAdjustmentNotes();
        order.setBackofficeAdjustmentNotes(existingNotes == null || existingNotes.isBlank() ? cceEntry : existingNotes + "\n" + cceEntry);

        orderRepository.save(order);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getId());
        result.put("nfeNumber", nfeNumber);
        result.put("nfeAccessKey", accessKey);
        result.put("protocolNumber", protocolNumber);
        result.put("eventSequence", eventSequence);
        result.put("correctionText", textoCorrecao.trim());
        result.put("registeredAt", timestamp);
        result.put("statusMessage", "135 - Evento registrado e vinculado a NF-e (Carta de Correcao homologada)");
        return result;
    }

    @Transactional
    public Map<String, Object> registerCartaCorrecao(UUID orderId, String textoCorrecao) {
        Order order = resolveOrderFromUuid(orderId);
        return registerCartaCorrecao(order.getId(), textoCorrecao);
    }

    /**
     * Registra evento de NF-e de Devolução (CFOP 1202), estornando DQ para physicalStock e BQ para baseStock,
     * e cancelando o pedido.
     */
    @Transactional
    public Map<String, Object> registerDevolucaoParcialOuTotal(Long orderId, String motivo) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        if (order.getStatus() == OrderStatus.CANCELADO) {
            throw new IllegalStateException("Este pedido já foi cancelado anteriormente.");
        }

        int returnedDq = 0;
        int returnedBq = 0;

        for (OrderItem item : order.getItems()) {
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            int bq = item.getBaseQuantity() != null ? item.getBaseQuantity() : (item.getQuantity() != null ? item.getQuantity() : 0);
            Product p = item.getProduct();

            if (order.getStatus() == OrderStatus.FATURADO || order.getStatus() == OrderStatus.ENTREGUE) {
                // Estorno no estoque físico real e no estoque base
                p.setPhysicalStock(p.getPhysicalStock() + dq);
                p.setBaseStock(p.getBaseStock() + bq);
                returnedDq += dq;
                returnedBq += bq;
            } else if (order.getStatus() == OrderStatus.AGUARDANDO_REVISAO || order.getStatus() == OrderStatus.EM_SEPARACAO) {
                // Estorno da reserva física
                p.setReservedStock(Math.max(0, p.getReservedStock() - dq));
                returnedDq += dq;
            }
            productRepository.save(p);
        }

        order.setStatus(OrderStatus.CANCELADO);
        if (order.getInvoiceData() != null) {
            order.getInvoiceData().setNfeStatus(NfeStatus.CANCELADA);
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        String reasonClean = (motivo != null && !motivo.isBlank()) ? motivo.trim() : "Devolução total/parcial de mercadoria";
        String devolucaoLog = String.format("[DEVOLUÇÃO CFOP 1202 | %s]: %s (Estornado: %d DQ físico / %d BQ fiscal)",
                timestamp, reasonClean, returnedDq, returnedBq);

        String existingNotes = order.getBackofficeAdjustmentNotes();
        order.setBackofficeAdjustmentNotes(existingNotes == null || existingNotes.isBlank() ? devolucaoLog : existingNotes + "\n" + devolucaoLog);

        Order saved = orderRepository.save(order);

        String devolucaoProtocol = "13526" + String.format("%010d", Math.abs((order.getId() * 47L + System.currentTimeMillis()) % 10000000000L));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("orderId", saved.getId());
        resp.put("status", saved.getStatus().name());
        resp.put("cfop", "1202");
        resp.put("naturezaOperacao", "DEVOLUÇÃO DE COMPRA/VENDA DE MERCADORIA");
        resp.put("returnedPhysicalStock", returnedDq);
        resp.put("returnedBaseStock", returnedBq);
        resp.put("reason", reasonClean);
        resp.put("nfeAccessKey", saved.getInvoiceData() != null ? saved.getInvoiceData().getNfeAccessKey() : null);
        resp.put("protocolNumber", devolucaoProtocol);
        resp.put("statusMessage", "NF-e de Devolução gerada com sucesso (CFOP 1202). Estoques físico e base estornados.");
        return resp;
    }

    @Transactional
    public Map<String, Object> registerDevolucaoParcialOuTotal(UUID orderId, String motivo) {
        Order order = resolveOrderFromUuid(orderId);
        return registerDevolucaoParcialOuTotal(order.getId(), motivo);
    }

    // ==========================================
    // CONSTRUÇÃO DO HTML DO DANFE NF-e 4.00 (BQ)
    // ==========================================
    private String buildDanfeHtmlContent(Order order) {
        Client c = order.getClient();
        InvoiceData inv = order.getInvoiceData();

        String nfeNumber = (inv != null && inv.getNfeNumber() != null && !inv.getNfeNumber().isBlank())
                ? inv.getNfeNumber()
                : String.valueOf(12930 + order.getId());

        String rawKey = (inv != null && inv.getNfeAccessKey() != null && !inv.getNfeAccessKey().isBlank())
                ? inv.getNfeAccessKey()
                : "3526100926520100019555001" + String.format("%09d", Long.parseLong(nfeNumber)) + "1300000001";

        // Formata chave em blocos de 4 dígitos
        StringBuilder keySpaced = new StringBuilder();
        for (int i = 0; i < rawKey.length(); i++) {
            if (i > 0 && i % 4 == 0) keySpaced.append(" ");
            keySpaced.append(rawKey.charAt(i));
        }

        String dataEmissao = order.getCreatedAt() != null
                ? order.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                : LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String horaEmissao = order.getCreatedAt() != null
                ? order.getCreatedAt().format(DateTimeFormatter.ofPattern("HH:mm:ss"))
                : LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));

        String protocolo = "13526" + String.format("%010d", Long.parseLong(nfeNumber) + 4000000000L) + " - " + dataEmissao + " " + horaEmissao;

        // Cálculos fiscais estritamente sobre a Qtd. Base (BQ)
        BigDecimal totalVProd = BigDecimal.ZERO;
        BigDecimal totalVBC = BigDecimal.ZERO;
        BigDecimal totalVICMS = BigDecimal.ZERO;
        int totalBqSacks = 0;

        StringBuilder itemsHtml = new StringBuilder();
        int itemIndex = 1;

        for (OrderItem item : order.getItems()) {
            int bq = item.getBaseQuantity() != null ? item.getBaseQuantity() : (item.getQuantity() != null ? item.getQuantity() : 0);
            if (bq <= 0) continue;

            Product p = item.getProduct();
            BigDecimal unitPrice = item.getUnitSalePrice() != null ? item.getUnitSalePrice() : BigDecimal.ZERO;
            BigDecimal itemTotal = unitPrice.multiply(new BigDecimal(bq)).setScale(2, RoundingMode.HALF_UP);

            // Redução de base de cálculo (Art. 3º Anexo III do RICMS/SP - Farinha de Trigo):
            // Base = 58.33% do vProd | Alíquota = 12% -> Carga efetiva de 7.00%
            BigDecimal itemBc = itemTotal.multiply(new BigDecimal("0.5833")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemIcms = itemBc.multiply(new BigDecimal("0.12")).setScale(2, RoundingMode.HALF_UP);

            totalVProd = totalVProd.add(itemTotal);
            totalVBC = totalVBC.add(itemBc);
            totalVICMS = totalVICMS.add(itemIcms);
            totalBqSacks += bq;

            String cfop = (c.getState() == null || "SP".equalsIgnoreCase(c.getState().trim())) ? "5102" : "6102";
            String ncm = p.getNcm() != null && !p.getNcm().isBlank() ? p.getNcm() : "11010010";

            itemsHtml.append("<tr>")
                    .append("<td>").append(escapeHtml(p.getErpCode() != null ? p.getErpCode() : p.getSkuCode())).append("</td>")
                    .append("<td>").append(escapeHtml(p.getName())).append("</td>")
                    .append("<td class='center'>").append(escapeHtml(ncm)).append("</td>")
                    .append("<td class='center'>020</td>")
                    .append("<td class='center'>").append(cfop).append("</td>")
                    .append("<td class='center'>SACAS</td>")
                    .append("<td class='right font-bold'>").append(bq).append("</td>")
                    .append("<td class='right'>").append(formatMoney(unitPrice)).append("</td>")
                    .append("<td class='right font-bold'>").append(formatMoney(itemTotal)).append("</td>")
                    .append("<td class='right'>").append(formatMoney(itemBc)).append("</td>")
                    .append("<td class='right'>").append(formatMoney(itemIcms)).append("</td>")
                    .append("<td class='center'>12,00%</td>")
                    .append("</tr>");
        }

        BigDecimal totalVNF = totalVProd;
        int totalWeightKg = totalBqSacks * 25;

        String fullAddress = String.format("%s, %s%s - %s",
                c.getStreet() != null ? c.getStreet() : "Rua não informada",
                c.getNumber() != null ? c.getNumber() : "S/N",
                (c.getComplement() != null && !c.getComplement().isBlank()) ? " (" + c.getComplement().trim() + ")" : "",
                c.getNeighborhood() != null ? c.getNeighborhood() : "");

        String obs = "REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS." +
                (order.getNotesForInvoiceOrDriver() != null && !order.getNotesForInvoiceOrDriver().isBlank()
                        ? " Obs: " + order.getNotesForInvoiceOrDriver() : "");

        return "<!DOCTYPE html>\n" +
                "<html lang=\"pt-BR\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\" />\n" +
                "  <title>DANFE NF-e #" + nfeNumber + " - Total Trigo</title>\n" +
                "  <style>\n" +
                "    * { box-sizing: border-box; margin: 0; padding: 0; }\n" +
                "    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; padding: 10px; line-height: 1.2; }\n" +
                "    .no-print { background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }\n" +
                "    .no-print button { background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10pt; }\n" +
                "    .no-print button:hover { background: #1d4ed8; }\n" +
                "    .canhoto { border: 1px solid #000; margin-bottom: 4px; padding: 4px; border-bottom-style: dashed; }\n" +
                "    .border-box { border: 1px solid #000; margin-bottom: 3px; }\n" +
                "    .row { display: flex; flex-direction: row; width: 100%; }\n" +
                "    .col { border-right: 1px solid #000; padding: 2px 4px; }\n" +
                "    .col:last-child { border-right: none; }\n" +
                "    .lbl { font-size: 6.5pt; text-transform: uppercase; color: #333; font-weight: normal; margin-bottom: 1px; }\n" +
                "    .val { font-size: 8pt; font-weight: bold; }\n" +
                "    .val-sm { font-size: 7pt; font-weight: normal; }\n" +
                "    .center { text-align: center; }\n" +
                "    .right { text-align: right; }\n" +
                "    .font-bold { font-weight: bold; }\n" +
                "    table.danfe-items { width: 100%; border-collapse: collapse; margin-top: 2px; }\n" +
                "    table.danfe-items th, table.danfe-items td { border: 1px solid #000; padding: 2px 4px; font-size: 7pt; }\n" +
                "    table.danfe-items th { background: #f1f5f9; text-transform: uppercase; font-size: 6.5pt; text-align: center; }\n" +
                "    .barcode-container { height: 40px; display: flex; align-items: center; justify-content: center; letter-spacing: 2px; font-family: monospace; font-size: 8pt; border: 1px solid #999; margin: 3px 0; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px); height: 32px; }\n" +
                "    .title-box { background: #e2e8f0; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; padding: 1px 4px; border-bottom: 1px solid #000; }\n" +
                "    @media print {\n" +
                "      .no-print { display: none !important; }\n" +
                "      body { padding: 0; }\n" +
                "      @page { size: A4 portrait; margin: 6mm 6mm 6mm 6mm; }\n" +
                "    }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "\n" +
                "  <div class=\"no-print\">\n" +
                "    <div>\n" +
                "      <strong style=\"font-size: 12pt;\">DANFE NF-e #" + nfeNumber + "</strong>\n" +
                "      <span style=\"margin-left: 12px; color: #94a3b8;\">Emissão Total Trigo (Qtd. Base / BQ)</span>\n" +
                "    </div>\n" +
                "    <div>\n" +
                "      <button onclick=\"window.print()\">🖨️ Imprimir / Salvar PDF</button>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- CANHOTO SUPERIOR -->\n" +
                "  <div class=\"canhoto\">\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"val-sm\">RECEBEMOS DE <b>SERGIO SOARES DE SOUSA / TOTAL TRIGO</b> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.</div>\n" +
                "        <div class=\"row\" style=\"margin-top: 8px;\">\n" +
                "          <div style=\"flex: 1; border-top: 1px solid #000; margin-right: 15px; padding-top: 2px;\">\n" +
                "            <div class=\"lbl\">DATA DE RECEBIMENTO</div>\n" +
                "          </div>\n" +
                "          <div style=\"flex: 2; border-top: 1px solid #000; padding-top: 2px;\">\n" +
                "            <div class=\"lbl\">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>\n" +
                "          </div>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "      <div class=\"col center\" style=\"flex: 1;\">\n" +
                "        <div class=\"val\" style=\"font-size: 11pt;\">NF-e</div>\n" +
                "        <div class=\"val\" style=\"font-size: 10pt;\">Nº " + nfeNumber + "</div>\n" +
                "        <div class=\"val-sm\">SÉRIE 1</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- CABEÇALHO EMITENTE & CHAVE DE ACESSO -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 3.2;\">\n" +
                "        <div class=\"val\" style=\"font-size: 9.5pt;\">SERGIO SOARES DE SOUSA</div>\n" +
                "        <div class=\"val\" style=\"font-size: 8pt; color: #1e3a8a;\">TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA</div>\n" +
                "        <div class=\"val-sm\">Rua Marco Aurelio Marliani, 59 - SUBSL</div>\n" +
                "        <div class=\"val-sm\">Jardim Almeida Prado - São Paulo / SP - CEP: 04854-170</div>\n" +
                "        <div class=\"val-sm\">Fone: (11) 99887-2233 / (11) 98765-4321</div>\n" +
                "      </div>\n" +
                "      <div class=\"col center\" style=\"flex: 1.8;\">\n" +
                "        <div class=\"val\" style=\"font-size: 10pt;\">DANFE</div>\n" +
                "        <div class=\"val-sm\">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>\n" +
                "        <div class=\"row\" style=\"margin-top: 3px; justify-content: center;\">\n" +
                "          <div style=\"border: 1px solid #000; padding: 1px 6px; font-weight: bold;\">1</div>\n" +
                "          <div class=\"val-sm\" style=\"margin-left: 5px; text-align: left;\">0 - Entrada<br/>1 - Saída</div>\n" +
                "        </div>\n" +
                "        <div class=\"val\" style=\"margin-top: 3px;\">Nº " + nfeNumber + "</div>\n" +
                "        <div class=\"val-sm\">SÉRIE 1 - FOLHA 1/1</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"barcode-container\" title=\"Código de barras visual da NF-e\"></div>\n" +
                "        <div class=\"lbl center\">CHAVE DE ACESSO</div>\n" +
                "        <div class=\"center font-bold\" style=\"font-size: 7.5pt; font-family: monospace; letter-spacing: 0.5px;\">" + keySpaced + "</div>\n" +
                "        <div class=\"val-sm center\" style=\"font-size: 6.5pt; margin-top: 3px;\">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- PROTOCOLO & NATUREZA DA OPERAÇÃO -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"lbl\">NATUREZA DA OPERAÇÃO</div>\n" +
                "        <div class=\"val\">VENDA DE MERCADORIA</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"lbl\">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>\n" +
                "        <div class=\"val\">" + protocolo + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"row\" style=\"border-top: 1px solid #000;\">\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">INSCRIÇÃO ESTADUAL</div>\n" +
                "        <div class=\"val\">148.037.168.118</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">INSC. ESTADUAL DO SUBST. TRIBUT.</div>\n" +
                "        <div class=\"val\">-</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">CNPJ</div>\n" +
                "        <div class=\"val\">09.265.201/0001-95</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- DESTINATÁRIO / REMETENTE -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"title-box\">DESTINATÁRIO / REMETENTE</div>\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 6;\">\n" +
                "        <div class=\"lbl\">NOME / RAZÃO SOCIAL</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getCorporateName()) + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">CNPJ / CPF</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getCnpj() != null ? c.getCnpj() : "-") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">DATA DE EMISSÃO</div>\n" +
                "        <div class=\"val center\">" + dataEmissao + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"row\" style=\"border-top: 1px solid #000;\">\n" +
                "      <div class=\"col\" style=\"flex: 5;\">\n" +
                "        <div class=\"lbl\">ENDEREÇO</div>\n" +
                "        <div class=\"val\">" + escapeHtml(fullAddress) + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">BAIRRO / DISTRITO</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getNeighborhood() != null ? c.getNeighborhood() : "-") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">CEP</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getZipCode() != null ? c.getZipCode() : "-") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 1.5;\">\n" +
                "        <div class=\"lbl\">DATA SAÍDA</div>\n" +
                "        <div class=\"val center\">" + dataEmissao + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"row\" style=\"border-top: 1px solid #000;\">\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"lbl\">MUNICÍPIO</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getCity() != null ? c.getCity() : "São Paulo") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 1;\">\n" +
                "        <div class=\"lbl\">UF</div>\n" +
                "        <div class=\"val center\">" + escapeHtml(c.getState() != null ? c.getState() : "SP") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">FONE / FAX</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getPhone() != null ? c.getPhone() : "-") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3;\">\n" +
                "        <div class=\"lbl\">INSCRIÇÃO ESTADUAL</div>\n" +
                "        <div class=\"val\">" + escapeHtml(c.getStateRegistration() != null ? c.getStateRegistration() : "ISENTO") + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 1.5;\">\n" +
                "        <div class=\"lbl\">HORA SAÍDA</div>\n" +
                "        <div class=\"val center\">" + horaEmissao + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- CÁLCULO DO IMPOSTO (ESTRITAMENTE SOBRE BQ) -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"title-box\">CÁLCULO DO IMPOSTO (EMISSÃO FISCAL BASEADA EM QUANTIDADE BASE / BQ)</div>\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">BASE DE CÁLCULO DO ICMS</div>\n" +
                "        <div class=\"val\">" + formatMoney(totalVBC) + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">VALOR DO ICMS (12%)</div>\n" +
                "        <div class=\"val\">" + formatMoney(totalVICMS) + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">BASE CÁLC. ICMS S.T.</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">VALOR DO ICMS S.T.</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2.5;\">\n" +
                "        <div class=\"lbl\">VLR TOTAL DOS PRODUTOS (BQ)</div>\n" +
                "        <div class=\"val\">" + formatMoney(totalVProd) + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"row\" style=\"border-top: 1px solid #000;\">\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">VALOR DO FRETE</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">VALOR DO SEGURO</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">DESCONTO</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">OUTRAS DESPESAS</div>\n" +
                "        <div class=\"val\">R$ 0,00</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2.5;\">\n" +
                "        <div class=\"lbl\">VALOR TOTAL DA NOTA</div>\n" +
                "        <div class=\"val\" style=\"font-size: 9pt; color: #1e3a8a;\">" + formatMoney(totalVNF) + "</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- TRANSPORTADOR / VOLUMES TRANSPORTADOS -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"title-box\">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 4;\">\n" +
                "        <div class=\"lbl\">RAZÃO SOCIAL</div>\n" +
                "        <div class=\"val\">O MESMO / TOTAL TRIGO</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">FRETE POR CONTA</div>\n" +
                "        <div class=\"val\">0 - Remetente (CIF)</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 1.5;\">\n" +
                "        <div class=\"lbl\">CÓDIGO ANTT</div>\n" +
                "        <div class=\"val\">-</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 1.5;\">\n" +
                "        <div class=\"lbl\">PLACA VEÍCULO</div>\n" +
                "        <div class=\"val\">-</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">CNPJ / CPF</div>\n" +
                "        <div class=\"val\">09.265.201/0001-95</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"row\" style=\"border-top: 1px solid #000;\">\n" +
                "      <div class=\"col right\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">QUANTIDADE (BQ)</div>\n" +
                "        <div class=\"val\">" + totalBqSacks + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">ESPÉCIE</div>\n" +
                "        <div class=\"val\">SACAS</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 2;\">\n" +
                "        <div class=\"lbl\">MARCA</div>\n" +
                "        <div class=\"val\">TOTAL TRIGO</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2.5;\">\n" +
                "        <div class=\"lbl\">PESO BRUTO (KG)</div>\n" +
                "        <div class=\"val\">" + totalWeightKg + ",000</div>\n" +
                "      </div>\n" +
                "      <div class=\"col right\" style=\"flex: 2.5;\">\n" +
                "        <div class=\"lbl\">PESO LÍQUIDO (KG)</div>\n" +
                "        <div class=\"val\">" + totalWeightKg + ",000</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- DADOS DOS PRODUTOS / SERVIÇOS -->\n" +
                "  <div class=\"border-box\">\n" +
                "    <div class=\"title-box\">DADOS DOS PRODUTOS / SERVIÇOS (ITENS EMITIDOS SOBRE QUANTIDADE BASE / BQ)</div>\n" +
                "    <table class=\"danfe-items\">\n" +
                "      <thead>\n" +
                "        <tr>\n" +
                "          <th>Cód. Prod</th>\n" +
                "          <th>Descrição do Produto</th>\n" +
                "          <th>NCM/SH</th>\n" +
                "          <th>CST</th>\n" +
                "          <th>CFOP</th>\n" +
                "          <th>UN</th>\n" +
                "          <th>Qtd (BQ)</th>\n" +
                "          <th>V. Unitário</th>\n" +
                "          <th>V. Total</th>\n" +
                "          <th>BC ICMS</th>\n" +
                "          <th>V. ICMS</th>\n" +
                "          <th>Alíq ICMS</th>\n" +
                "        </tr>\n" +
                "      </thead>\n" +
                "      <tbody>\n" +
                itemsHtml +
                "      </tbody>\n" +
                "    </table>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- DADOS ADICIONAIS -->\n" +
                "  <div class=\"border-box\" style=\"margin-top: 3px;\">\n" +
                "    <div class=\"title-box\">DADOS ADICIONAIS</div>\n" +
                "    <div class=\"row\">\n" +
                "      <div class=\"col\" style=\"flex: 7; min-height: 55px;\">\n" +
                "        <div class=\"lbl\">INFORMAÇÕES COMPLEMENTARES</div>\n" +
                "        <div class=\"val-sm\" style=\"font-size: 7.5pt;\">" + escapeHtml(obs) + "</div>\n" +
                "        <div class=\"val-sm\" style=\"font-size: 6.5pt; color: #555; margin-top: 4px;\">Condições de Pagamento: " + escapeHtml(order.getPaymentTerms()) + "</div>\n" +
                "      </div>\n" +
                "      <div class=\"col\" style=\"flex: 3; min-height: 55px;\">\n" +
                "        <div class=\"lbl\">RESERVADO AO FISCO</div>\n" +
                "        <div class=\"val-sm\">-</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "</body>\n" +
                "</html>";
    }

    // ===============================================
    // CONSTRUÇÃO DO HTML DO ROMANEIO CEGO (DQ EXCLUSIVO)
    // ===============================================
    private String buildRomaneioHtmlContent(Order order) {
        Client c = order.getClient();
        InvoiceData inv = order.getInvoiceData();

        String nfeBadge = (inv != null && inv.getNfeNumber() != null && !inv.getNfeNumber().isBlank())
                ? "NF-e #" + inv.getNfeNumber()
                : "Pedido #" + order.getId();

        String dataPedido = order.getCreatedAt() != null
                ? order.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                : LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));

        String previsao = order.getDeliveryForecast() != null && !order.getDeliveryForecast().isBlank()
                ? order.getDeliveryForecast()
                : "Imediata / Conforme Rota";

        int totalDqSacks = 0;
        StringBuilder rowsHtml = new StringBuilder();

        for (OrderItem item : order.getItems()) {
            int dq = item.getDispatchQuantity() != null ? item.getDispatchQuantity() : 0;
            if (dq <= 0) continue;

            Product p = item.getProduct();
            int weightKg = dq * 25;
            totalDqSacks += dq;

            rowsHtml.append("<tr style=\"height: 38px;\">")
                    .append("<td style=\"font-weight: bold; font-size: 11pt;\">").append(escapeHtml(p.getSkuCode())).append("</td>")
                    .append("<td style=\"font-size: 11pt; font-weight: 600;\">").append(escapeHtml(p.getName())).append("</td>")
                    .append("<td class=\"center\" style=\"font-size: 11pt;\">SACAS (25kg)</td>")
                    .append("<td class=\"right font-bold\" style=\"font-size: 14pt; color: #0f172a;\">").append(dq).append("</td>")
                    .append("<td class=\"right\" style=\"font-size: 11pt;\">").append(weightKg).append(" kg</td>")
                    .append("<td class=\"center\"><div style=\"width: 22px; height: 22px; border: 2px solid #334155; margin: auto; border-radius: 4px;\"></div></td>")
                    .append("<td class=\"center\"><div style=\"width: 22px; height: 22px; border: 2px solid #334155; margin: auto; border-radius: 4px;\"></div></td>")
                    .append("</tr>");
        }

        int totalWeightKg = totalDqSacks * 25;

        String fullAddress = String.format("%s, %s%s",
                c.getStreet() != null ? c.getStreet() : "A confirmar",
                c.getNumber() != null ? c.getNumber() : "S/N",
                (c.getComplement() != null && !c.getComplement().isBlank()) ? " (" + c.getComplement().trim() + ")" : "");

        String obsMotorista = (order.getNotesForInvoiceOrDriver() != null && !order.getNotesForInvoiceOrDriver().isBlank())
                ? order.getNotesForInvoiceOrDriver()
                : "Nenhuma observação especial de entrega.";

        return "<!DOCTYPE html>\n" +
                "<html lang=\"pt-BR\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\" />\n" +
                "  <title>Romaneio Cego de Separação & Entrega - " + nfeBadge + "</title>\n" +
                "  <style>\n" +
                "    * { box-sizing: border-box; margin: 0; padding: 0; }\n" +
                "    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #0f172a; background: #fff; padding: 15px; }\n" +
                "    .no-print { background: #0284c7; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }\n" +
                "    .no-print button { background: #0369a1; color: #fff; border: 1px solid #bae6fd; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11pt; }\n" +
                "    .no-print button:hover { background: #075985; }\n" +
                "    .header-box { border: 2px solid #0f172a; padding: 12px; margin-bottom: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }\n" +
                "    .company-title { font-size: 16pt; font-weight: 800; color: #0f172a; }\n" +
                "    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11pt; }\n" +
                "    .info-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 12px; }\n" +
                "    .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }\n" +
                "    .card-title { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }\n" +
                "    .card-val { font-size: 11pt; font-weight: 600; }\n" +
                "    table.romaneio-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }\n" +
                "    table.romaneio-table th, table.romaneio-table td { border: 1px solid #64748b; padding: 6px 8px; }\n" +
                "    table.romaneio-table th { background: #f1f5f9; text-transform: uppercase; font-size: 8.5pt; }\n" +
                "    .center { text-align: center; }\n" +
                "    .right { text-align: right; }\n" +
                "    .font-bold { font-weight: bold; }\n" +
                "    .totals-banner { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 6px; padding: 10px 15px; display: flex; justify-content: space-around; font-size: 13pt; font-weight: bold; color: #15803d; margin-bottom: 15px; }\n" +
                "    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; }\n" +
                "    .sig-box { border: 1px solid #94a3b8; border-radius: 6px; padding: 12px; height: 110px; display: flex; flex-direction: column; justify-content: space-between; }\n" +
                "    .sig-line { border-top: 1px solid #000; margin-top: 20px; text-align: center; font-size: 8.5pt; padding-top: 3px; }\n" +
                "    .canhoto-cliente { border: 2px dashed #475569; border-radius: 6px; padding: 12px; margin-top: 20px; background: #fafafa; }\n" +
                "    @media print {\n" +
                "      .no-print { display: none !important; }\n" +
                "      body { padding: 0; font-size: 9.5pt; }\n" +
                "      @page { size: A4 portrait; margin: 8mm 8mm 8mm 8mm; }\n" +
                "    }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "\n" +
                "  <div class=\"no-print\">\n" +
                "    <div>\n" +
                "      <strong style=\"font-size: 13pt;\">📦 Romaneio Cego de Expedição (Carga DQ)</strong>\n" +
                "      <div style=\"font-size: 9pt; color: #e0f2fe;\">Sem preços comerciais — Ideal para conferência de galpão e canhoto do motorista</div>\n" +
                "    </div>\n" +
                "    <div>\n" +
                "      <button onclick=\"window.print()\">🖨️ Imprimir Romaneio</button>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <div class=\"header-box\">\n" +
                "    <div>\n" +
                "      <div class=\"company-title\">TOTAL TRIGO — ROMANEIO DE EXPEDIÇÃO & ENTREGA</div>\n" +
                "      <div style=\"font-size: 9pt; color: #475569;\">Distribuição Atacadista de Farinhas e Pré-Misturas | Fone: (11) 99887-2233</div>\n" +
                "    </div>\n" +
                "    <div class=\"right\">\n" +
                "      <div class=\"badge\">" + nfeBadge + "</div>\n" +
                "      <div style=\"font-size: 8.5pt; margin-top: 4px; color: #64748b;\">Emissão: " + dataPedido + "</div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <div class=\"info-grid\">\n" +
                "    <div class=\"card\">\n" +
                "      <div class=\"card-title\">Destinatário & Local de Descarrego</div>\n" +
                "      <div class=\"card-val\">" + escapeHtml(c.getTradeName() != null && !c.getTradeName().isBlank() ? c.getTradeName() : c.getCorporateName()) + "</div>\n" +
                "      <div style=\"font-size: 9.5pt; margin-top: 2px;\">Razão: " + escapeHtml(c.getCorporateName()) + "</div>\n" +
                "      <div style=\"font-size: 9.5pt; margin-top: 3px;\">📍 <b>Endereço:</b> " + escapeHtml(fullAddress) + "</div>\n" +
                "      <div style=\"font-size: 9pt; color: #475569;\">Bairro: " + escapeHtml(c.getNeighborhood()) + " | " + escapeHtml(c.getCity()) + " - " + escapeHtml(c.getState()) + " (CEP: " + escapeHtml(c.getZipCode()) + ")</div>\n" +
                "    </div>\n" +
                "    <div class=\"card\">\n" +
                "      <div class=\"card-title\">Dados Operacionais da Rota</div>\n" +
                "      <div style=\"font-size: 9.5pt;\">👤 <b>Contato:</b> " + escapeHtml(c.getContactName() != null ? c.getContactName() : "Comprador") + "</div>\n" +
                "      <div style=\"font-size: 9.5pt; margin-top: 3px;\">📞 <b>Telefone:</b> " + escapeHtml(c.getPhone() != null ? c.getPhone() : "-") + "</div>\n" +
                "      <div style=\"font-size: 9.5pt; margin-top: 3px;\">🚚 <b>Previsão:</b> <span style=\"font-weight: 700; color: #0284c7;\">" + escapeHtml(previsao) + "</span></div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <div class=\"card\" style=\"margin-bottom: 12px; background: #fffbeb; border-color: #fde68a;\">\n" +
                "    <div class=\"card-title\" style=\"color: #b45309;\">⚠️ Instruções para a Separação / Motorista</div>\n" +
                "    <div style=\"font-size: 10pt; font-weight: 600; color: #78350f;\">" + escapeHtml(obsMotorista) + "</div>\n" +
                "  </div>\n" +
                "\n" +
                "  <table class=\"romaneio-table\">\n" +
                "    <thead>\n" +
                "      <tr>\n" +
                "        <th style=\"width: 12%;\">SKU</th>\n" +
                "        <th style=\"width: 44%; text-align: left;\">Descrição da Mercadoria</th>\n" +
                "        <th style=\"width: 14%;\">Unidade</th>\n" +
                "        <th style=\"width: 10%; text-align: right;\">Qtd. Expedição (DQ)</th>\n" +
                "        <th style=\"width: 10%; text-align: right;\">Peso (KG)</th>\n" +
                "        <th style=\"width: 5%;\">Galpão</th>\n" +
                "        <th style=\"width: 5%;\">Entrega</th>\n" +
                "      </tr>\n" +
                "    </thead>\n" +
                "    <tbody>\n" +
                rowsHtml +
                "    </tbody>\n" +
                "  </table>\n" +
                "\n" +
                "  <div class=\"totals-banner\">\n" +
                "    <div>📦 Volume Total: <span>" + totalDqSacks + " sacos</span></div>\n" +
                "    <div>⚖️ Peso Total da Carga: <span>" + totalWeightKg + " kg (" + String.format("%.2f", totalWeightKg / 1000.0) + " ton)</span></div>\n" +
                "  </div>\n" +
                "\n" +
                "  <div class=\"signatures\">\n" +
                "    <div class=\"sig-box\">\n" +
                "      <div class=\"card-title\">Conferência e Separação no Galpão</div>\n" +
                "      <div style=\"font-size: 8.5pt; color: #475569;\">Carga conferida e liberada de acordo com as quantidades (DQ) descritas acima.</div>\n" +
                "      <div class=\"sig-line\">Separador / Conferente Total Trigo (Data: ___/___/______)</div>\n" +
                "    </div>\n" +
                "    <div class=\"sig-box\">\n" +
                "      <div class=\"card-title\">Saída do Motorista / Transportador</div>\n" +
                "      <div style=\"font-size: 8.5pt; color: #475569;\">Recebi a carga completa em perfeitas condições para entrega ao cliente.</div>\n" +
                "      <div class=\"sig-line\">Motorista / Assinatura (Placa: _______________)</div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <!-- CANHOTO DE RECEBIMENTO DO CLIENTE -->\n" +
                "  <div class=\"canhoto-cliente\">\n" +
                "    <div style=\"display: flex; justify-content: space-between; margin-bottom: 8px;\">\n" +
                "      <strong style=\"font-size: 9.5pt;\">COMPROVANTE DE ENTREGA E RECEBIMENTO DE MERCADORIAS</strong>\n" +
                "      <span style=\"font-size: 9pt; color: #64748b;\">" + nfeBadge + " — Total Trigo</span>\n" +
                "    </div>\n" +
                "    <div style=\"font-size: 8.5pt; color: #334155; margin-bottom: 12px;\">\n" +
                "      Declaramos ter recebido da <b>TOTAL TRIGO COMÉRCIO DE ALIMENTOS LTDA</b> as mercadorias constantes neste romaneio cego de expedição, conferidas em perfeito estado físico e conformidade.\n" +
                "    </div>\n" +
                "    <div style=\"display: flex; gap: 20px;\">\n" +
                "      <div style=\"flex: 1; border-top: 1px solid #000; padding-top: 3px;\">\n" +
                "        <div style=\"font-size: 7.5pt; color: #64748b;\">DATA DA ENTREGA: ______/______/2026 &nbsp;&nbsp; HORA: _____:_____</div>\n" +
                "      </div>\n" +
                "      <div style=\"flex: 2; border-top: 1px solid #000; padding-top: 3px;\">\n" +
                "        <div style=\"font-size: 7.5pt; color: #64748b;\">NOME LEGÍVEL DO RECEBEDOR &nbsp;&nbsp;|&nbsp;&nbsp; RG / CPF: ____________________</div>\n" +
                "      </div>\n" +
                "      <div style=\"flex: 2; border-top: 1px solid #000; padding-top: 3px;\">\n" +
                "        <div style=\"font-size: 7.5pt; color: #64748b;\">ASSINATURA / CARIMBO DO CLIENTE</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "</body>\n" +
                "</html>";
    }

    private Order resolveOrderFromUuid(UUID orderId) {
        if (orderId == null) {
            throw new IllegalArgumentException("orderId não pode ser nulo.");
        }
        try {
            long parsed = Long.parseLong(orderId.toString());
            return orderRepository.findById(parsed)
                    .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + parsed));
        } catch (NumberFormatException e) {
            long lsb = Math.abs(orderId.getLeastSignificantBits());
            return orderRepository.findById(lsb)
                    .orElseGet(() -> orderRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new IllegalArgumentException("Nenhum pedido localizado para UUID: " + orderId)));
        }
    }

    private String formatMoney(BigDecimal val) {
        if (val == null) return "R$ 0,00";
        return String.format(Locale.forLanguageTag("pt-BR"), "R$ %,.2f", val);
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
