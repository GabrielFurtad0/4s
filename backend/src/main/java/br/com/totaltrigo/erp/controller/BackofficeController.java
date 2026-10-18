package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.domain.model.ImportBatch;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.service.BackofficeService;
import br.com.totaltrigo.erp.service.BrasilApiService;
import br.com.totaltrigo.erp.service.FieldSalesService;
import br.com.totaltrigo.erp.service.XmlClientHistoryLoader;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/backoffice")
public class BackofficeController {

    private final BackofficeService backofficeService;
    private final FieldSalesService fieldSalesService;
    private final BrasilApiService brasilApiService;
    private final XmlClientHistoryLoader xmlClientHistoryLoader;

    public BackofficeController(
            BackofficeService backofficeService,
            FieldSalesService fieldSalesService,
            BrasilApiService brasilApiService,
            XmlClientHistoryLoader xmlClientHistoryLoader
    ) {
        this.backofficeService = backofficeService;
        this.fieldSalesService = fieldSalesService;
        this.brasilApiService = brasilApiService;
        this.xmlClientHistoryLoader = xmlClientHistoryLoader;
    }

    @GetMapping("/stock")
    public ResponseEntity<Map<String, Object>> getStockSummary() {
        return ResponseEntity.ok(fieldSalesService.getTopbarSummary());
    }

    @GetMapping("/orders")
    public ResponseEntity<List<BackofficeOrderDto>> listOrders(
            @RequestParam(required = false, defaultValue = "ALL") String status
    ) {
        return ResponseEntity.ok(backofficeService.listOrders(status));
    }

    @PutMapping("/orders/{orderId}/review")
    public ResponseEntity<BackofficeOrderDto> reviewAndAdjustPreNota(
            @PathVariable Long orderId,
            @Valid @RequestBody ReviewOrderRequest request
    ) {
        return ResponseEntity.ok(backofficeService.reviewAndAdjustPreNota(orderId, request));
    }

    @PostMapping("/orders/{orderId}/picking")
    public ResponseEntity<RomaneioDto> generateRomaneio(@PathVariable Long orderId) {
        return ResponseEntity.ok(backofficeService.generateRomaneioAndMoveToPicking(orderId));
    }

    @PostMapping("/orders/{orderId}/issue-nfe")
    public ResponseEntity<BackofficeOrderDto> issueNfe(@PathVariable Long orderId) {
        return ResponseEntity.ok(backofficeService.issueNfe(orderId));
    }

    @PostMapping("/orders/{orderId}/deliver")
    public ResponseEntity<BackofficeOrderDto> deliverOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(backofficeService.markOrderDelivered(orderId));
    }

    @PostMapping("/orders/{orderId}/cancel")
    public ResponseEntity<BackofficeOrderDto> cancelOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(backofficeService.cancelOrder(orderId));
    }

    @GetMapping(value = "/orders/{orderId}/xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> downloadNfeXml(@PathVariable Long orderId) {
        String xml = backofficeService.getOrderXml(orderId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "inline; filename=\"NFe_Order_" + orderId + ".xml\"")
                .body(xml);
    }

    @GetMapping("/fiscal/cnpj/{cnpj}")
    public ResponseEntity<CnpjLookupResponseDto> lookupCnpj(@PathVariable String cnpj) {
        return ResponseEntity.ok(brasilApiService.lookupCnpj(cnpj));
    }

    @GetMapping("/import-batches")
    public ResponseEntity<List<ImportBatch>> listImportBatches() {
        return ResponseEntity.ok(backofficeService.listImportBatches());
    }

    @PostMapping("/import-batches")
    public ResponseEntity<ImportBatch> createImportBatch(@Valid @RequestBody CreateImportBatchRequest request) {
        return ResponseEntity.ok(backofficeService.registerImportBatch(request));
    }

    @PostMapping("/import-xml-folder")
    public ResponseEntity<Map<String, Object>> importXmlFolder(
            @RequestParam(required = false) String folderPath
    ) {
        return ResponseEntity.ok(xmlClientHistoryLoader.importFromXmlFolder(folderPath));
    }
}
