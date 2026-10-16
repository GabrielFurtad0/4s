package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.service.FieldSalesService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile")
public class FieldSalesController {

    private final FieldSalesService fieldSalesService;

    public FieldSalesController(FieldSalesService fieldSalesService) {
        this.fieldSalesService = fieldSalesService;
    }

    @GetMapping("/topbar")
    public ResponseEntity<Map<String, Object>> getTopbarSummary() {
        return ResponseEntity.ok(fieldSalesService.getTopbarSummary());
    }

    @GetMapping("/agenda")
    public ResponseEntity<List<AgendaCardDto>> getAgendaAndRadar() {
        return ResponseEntity.ok(fieldSalesService.getAgendaAndRadar());
    }

    @PostMapping("/visits")
    public ResponseEntity<AgendaCardDto> createVisitOrQuickClient(@Valid @RequestBody CreateVisitRequest request) {
        return ResponseEntity.ok(fieldSalesService.scheduleVisitOrQuickClient(request));
    }

    @GetMapping("/clients/{clientId}")
    public ResponseEntity<Client360Dto> getClient360(@PathVariable Long clientId) {
        return ResponseEntity.ok(fieldSalesService.getClient360(clientId));
    }

    @PostMapping("/clients/{clientId}/notes")
    public ResponseEntity<ClientNoteDto> addClientNote(
            @PathVariable Long clientId,
            @Valid @RequestBody AddNoteRequest request
    ) {
        return ResponseEntity.ok(fieldSalesService.addClientNote(clientId, request));
    }

    @PostMapping("/orders")
    public ResponseEntity<BackofficeOrderDto> submitOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.ok(fieldSalesService.createOrderFromStreet(request));
    }
}
