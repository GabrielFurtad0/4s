package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.domain.model.ClientSkuPrice;
import br.com.totaltrigo.erp.domain.model.Product;
import br.com.totaltrigo.erp.domain.model.ReceivableTitle;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.service.ManagementExtensionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/backoffice/management")
public class ManagementExtensionController {

    private final ManagementExtensionService managementService;

    public ManagementExtensionController(ManagementExtensionService managementService) {
        this.managementService = managementService;
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
