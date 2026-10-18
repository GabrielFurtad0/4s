package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.domain.model.ClientSkuPrice;
import br.com.totaltrigo.erp.domain.model.Product;
import br.com.totaltrigo.erp.domain.model.ReceivableTitle;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.service.ClientXmlImportService;
import br.com.totaltrigo.erp.service.ManagementExtensionService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/backoffice/management")
public class ManagementExtensionController {

    private final ManagementExtensionService managementService;
    private final ClientXmlImportService clientXmlImportService;

    public ManagementExtensionController(
            ManagementExtensionService managementService,
            ClientXmlImportService clientXmlImportService
    ) {
        this.managementService = managementService;
        this.clientXmlImportService = clientXmlImportService;
    }

    // ============================================================================
    // 1. CONTAS A RECEBER E BOLETOS SOBRE BQ
    // ============================================================================

    @GetMapping("/receivables")
    public ResponseEntity<List<ReceivableTitleDto>> listReceivables(
            @RequestParam(required = false, defaultValue = "ALL") String status
    ) {
        return ResponseEntity.ok(managementService.listReceivableTitles(status));
    }

    @PostMapping("/receivables/{titleId}/pay")
    public ResponseEntity<ReceivableTitleDto> payReceivable(
            @PathVariable Long titleId,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(managementService.payTitle(titleId, actorName, actorRole));
    }

    // ============================================================================
    // 2. CADASTROS: CLIENTES, PRODUTOS/PREÇOS E AJUSTES DE ESTOQUE
    // ============================================================================

    @GetMapping("/clients")
    public ResponseEntity<List<ClientManagementDto>> listClients() {
        return ResponseEntity.ok(managementService.listClients());
    }

    @PostMapping("/clients")
    public ResponseEntity<ClientManagementDto> createClient(
            @Valid @RequestBody ClientManagementDto dto,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(managementService.createClient(dto, actorName, actorRole));
    }

    @PutMapping("/clients/{clientId}")
    public ResponseEntity<ClientManagementDto> updateClient(
            @PathVariable Long clientId,
            @Valid @RequestBody ClientManagementDto dto,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(managementService.updateClient(clientId, dto, actorName, actorRole));
    }

    @PostMapping(value = "/clients/import-xml", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<XmlClientImportResult> importClientsXml(
            @RequestParam("files") MultipartFile[] files,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        XmlClientImportResult result = clientXmlImportService.importFromFiles(files);
        managementService.logAudit(
                actorName,
                actorRole,
                "IMPORTACAO_XML_CLIENTES",
                "Client",
                "BATCH",
                String.format("Importação XML em lote: %d processados, %d criados, %d atualizados.",
                        result.totalFilesProcessed(), result.clientsCreated(), result.clientsUpdated())
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/clients/import-xml/raw", consumes = {MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE, MediaType.TEXT_PLAIN_VALUE})
    public ResponseEntity<XmlClientImportResult> importClientsRawXml(
            @RequestBody String xmlContent,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        XmlClientImportResult result = clientXmlImportService.importFromRawXml(xmlContent, "payload.xml");
        managementService.logAudit(
                actorName,
                actorRole,
                "IMPORTACAO_XML_CLIENTES_RAW",
                "Client",
                "RAW",
                String.format("Importação XML texto: %d criados, %d atualizados.",
                        result.clientsCreated(), result.clientsUpdated())
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/products")
    public ResponseEntity<List<Product>> listProducts() {
        return ResponseEntity.ok(managementService.listProducts());
    }

    @PutMapping("/products/{productId}")
    public ResponseEntity<Product> updateProduct(
            @PathVariable Long productId,
            @Valid @RequestBody ProductUpdateDto dto,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(managementService.updateProduct(productId, dto, actorName, actorRole));
    }

    @GetMapping("/client-prices")
    public ResponseEntity<List<ClientSkuPrice>> listClientPrices(@RequestParam Long clientId) {
        return ResponseEntity.ok(managementService.listClientPrices(clientId));
    }

    @PutMapping("/client-prices")
    public ResponseEntity<ClientSkuPrice> updateClientPrice(
            @Valid @RequestBody UpdateClientSkuPriceRequest req,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(managementService.updateClientPrice(req, actorName, actorRole));
    }

    // ============================================================================
    // 3. TRILHA DE AUDITORIA
    // ============================================================================

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLogDto>> listAuditLogs() {
        return ResponseEntity.ok(managementService.listAuditLogs());
    }

    // ============================================================================
    // 4. VISÃO EXECUTIVA REAL
    // ============================================================================

    @GetMapping("/executive-summary")
    public ResponseEntity<ExecutiveSummaryDto> getExecutiveSummary() {
        return ResponseEntity.ok(managementService.getExecutiveSummary());
    }
}
