package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.service.FiscalDocumentService;
import br.com.totaltrigo.erp.service.SpreadsheetSyncService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller REST para geração de documentos fiscais e operacionais imprimíveis (DANFE NF-e 4.00, Romaneio Cego DQ),
 * sincronização com a automação da planilha de estoques e registro de eventos fiscais (CC-e e Devolução CFOP 1202).
 */
@RestController
@RequestMapping("/api/backoffice/fiscal-documents")
@CrossOrigin(origins = "*")
public class FiscalDocumentController {

    private final FiscalDocumentService fiscalDocumentService;
    private final SpreadsheetSyncService spreadsheetSyncService;

    public FiscalDocumentController(
            FiscalDocumentService fiscalDocumentService,
            SpreadsheetSyncService spreadsheetSyncService
    ) {
        this.fiscalDocumentService = fiscalDocumentService;
        this.spreadsheetSyncService = spreadsheetSyncService;
    }

    /**
     * Retorna o HTML completo do DANFE Padrão NF-e 4.00 da Total Trigo pronto para impressão ou salvar como PDF,
     * calculado estritamente sobre a Quantidade Base (BQ).
     */
    @GetMapping(value = "/{orderId}/danfe.html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getDanfeHtml(@PathVariable String orderId) {
        Long id = parseOrderId(orderId);
        return ResponseEntity.ok(fiscalDocumentService.generateDanfeHtml(id));
    }

    /**
     * Retorna o HTML limpo do Romaneio Cego de Expedição & Entrega, exibindo exclusivamente a
     * Quantidade Expedição (DQ) sem preços e com canhoto de conferência e recebimento do cliente.
     */
    @GetMapping(value = "/{orderId}/romaneio.html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getRomaneioHtml(@PathVariable String orderId) {
        Long id = parseOrderId(orderId);
        return ResponseEntity.ok(fiscalDocumentService.generatePrintableRomaneioHtml(id));
    }

    /**
     * Sincroniza o XML da NF-e emitida com a pasta notas/ da automação e executa de forma segura
     * a atualização da Planilha de Estoques.xlsx via script Python.
     */
    @PostMapping("/{orderId}/sync-spreadsheet")
    public ResponseEntity<Map<String, Object>> syncSpreadsheet(@PathVariable String orderId) {
        Long id = parseOrderId(orderId);
        return ResponseEntity.ok(spreadsheetSyncService.syncIssuedInvoiceToSpreadsheet(id));
    }

    /**
     * Emite e vincula Carta de Correção Eletrônica (CC-e) à NF-e do pedido (mínimo 15 caracteres).
     */
    @PostMapping("/{orderId}/carta-correcao")
    public ResponseEntity<Map<String, Object>> emitCartaCorrecao(
            @PathVariable String orderId,
            @RequestBody Map<String, String> payload
    ) {
        Long id = parseOrderId(orderId);
        String text = null;
        if (payload != null) {
            text = payload.get("correctionText");
            if (text == null) text = payload.get("textoCorrecao");
            if (text == null) text = payload.get("text");
        }
        return ResponseEntity.ok(fiscalDocumentService.registerCartaCorrecao(id, text));
    }

    /**
     * Emite NF-e de Devolução (CFOP 1202), estornando quantidades física (DQ) e base (BQ),
     * e cancelando o pedido.
     */
    @PostMapping("/{orderId}/devolucao")
    public ResponseEntity<Map<String, Object>> emitDevolucao(
            @PathVariable String orderId,
            @RequestBody(required = false) Map<String, String> payload
    ) {
        Long id = parseOrderId(orderId);
        String reason = null;
        if (payload != null) {
            reason = payload.get("reason");
            if (reason == null) reason = payload.get("motivo");
        }
        return ResponseEntity.ok(fiscalDocumentService.registerDevolucaoParcialOuTotal(id, reason));
    }

    private Long parseOrderId(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId não pode ser vazio.");
        }
        try {
            return Long.parseLong(orderId.trim());
        } catch (NumberFormatException e) {
            try {
                UUID u = UUID.fromString(orderId.trim());
                return Math.abs(u.getLeastSignificantBits());
            } catch (Exception ex) {
                throw new IllegalArgumentException("Identificador de pedido inválido: " + orderId);
            }
        }
    }
}
