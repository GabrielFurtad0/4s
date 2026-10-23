package br.com.totaltrigo.erp.controller;

import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.loginWithPassword(request));
    }

    @PostMapping("/api/auth/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(@RequestBody GoogleAuthRequest request) {
        return ResponseEntity.ok(authService.loginWithGoogle(request));
    }

    @GetMapping("/api/auth/me")
    public ResponseEntity<AppUserDto> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        return ResponseEntity.ok(authService.getCurrentUserFromHeader(authHeader));
    }

    // ============================================================================
    // GESTÃO DE USUÁRIOS (BACKOFFICE)
    // ============================================================================

    @GetMapping("/api/backoffice/management/users")
    public ResponseEntity<List<AppUserDto>> listUsers() {
        return ResponseEntity.ok(authService.listUsers());
    }

    @PostMapping("/api/backoffice/management/users")
    public ResponseEntity<AppUserDto> createUser(
            @Valid @RequestBody SaveAppUserRequest request,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(authService.createUser(request, actorName, actorRole));
    }

    @PutMapping("/api/backoffice/management/users/{id}")
    public ResponseEntity<AppUserDto> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody SaveAppUserRequest request,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        return ResponseEntity.ok(authService.updateUser(id, request, actorName, actorRole));
    }

    @DeleteMapping("/api/backoffice/management/users/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(
            @PathVariable Long id,
            @RequestHeader(value = "X-Actor-Name", required = false, defaultValue = "Gabriel Furtado") String actorName,
            @RequestHeader(value = "X-Actor-Role", required = false, defaultValue = "Backoffice & Fiscal") String actorRole
    ) {
        authService.deleteUser(id, actorName, actorRole);
        return ResponseEntity.ok(Map.of("deleted", true, "id", id));
    }
}
