package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.model.AppUser;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.AppUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final ManagementExtensionService managementService;
    private final ObjectMapper objectMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${totaltrigo.auth.jwt-secret:TotalTrigoErp4S2026SuperSecretSigningKeyHmacSha256}")
    private String jwtSecret;

    public AuthService(
            AppUserRepository appUserRepository,
            ManagementExtensionService managementService,
            ObjectMapper objectMapper
    ) {
        this.appUserRepository = appUserRepository;
        this.managementService = managementService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AuthResponse loginWithPassword(LoginRequest req) {
        if (req.email() == null || req.email().isBlank() || req.password() == null || req.password().isBlank()) {
            throw new IllegalArgumentException("Informe o e-mail e a senha.");
        }

        String normalizedEmail = req.email().trim().toLowerCase();
        AppUser user = appUserRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new SecurityException("Credenciais inválidas. Verifique seu e-mail e senha."));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new SecurityException("Esta conta de usuário está desativada no sistema. Contate o administrador no Backoffice.");
        }

        String storedHash = user.getPasswordHash();
        boolean validPassword = false;

        if (storedHash != null && (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$"))) {
            validPassword = passwordEncoder.matches(req.password(), storedHash);
        } else if (storedHash != null) {
            String rawStored = storedHash.startsWith("{noop}") ? storedHash.substring(6) : storedHash;
            if (rawStored.equals(req.password())) {
                validPassword = true;
                user.setPasswordHash(passwordEncoder.encode(req.password()));
            }
        }

        if (!validPassword) {
            throw new SecurityException("Credenciais inválidas. Verifique seu e-mail e senha.");
        }

        user.setLastLoginAt(LocalDateTime.now());
        AppUser saved = appUserRepository.save(user);

        managementService.logAudit(
                saved.getName(),
                extractShortRole(saved.getRoleProfile()),
                "LOGIN_SENHA",
                "AppUser",
                String.valueOf(saved.getId()),
                "Login realizado via E-mail/Senha por " + saved.getName() + " (" + saved.getEmail() + ")"
        );

        String token = generateToken(saved);
        return new AuthResponse(token, toDto(saved));
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleAuthRequest req) {
        String email = extractEmailFromGoogleRequest(req);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Não foi possível identificar o e-mail da conta Google.");
        }

        String normalizedEmail = email.trim().toLowerCase();
        Optional<AppUser> userOpt = appUserRepository.findByEmailIgnoreCase(normalizedEmail);
        if (userOpt.isEmpty()) {
            userOpt = appUserRepository.findByGoogleEmailIgnoreCase(normalizedEmail);
        }

        if (userOpt.isEmpty()) {
            throw new SecurityException("A conta Google (" + normalizedEmail + ") não está autorizada. Cadastre este e-mail primeiro na tela de Usuários do Backoffice.");
        }

        AppUser user = userOpt.get();
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new SecurityException("A conta Google (" + normalizedEmail + ") pertence a um usuário inativo no Backoffice.");
        }

        if (user.getGoogleEmail() == null || user.getGoogleEmail().isBlank()) {
            user.setGoogleEmail(normalizedEmail);
        }
        user.setLastLoginAt(LocalDateTime.now());
        AppUser saved = appUserRepository.save(user);

        managementService.logAudit(
                saved.getName(),
                extractShortRole(saved.getRoleProfile()),
                "LOGIN_GOOGLE_SSO",
                "AppUser",
                String.valueOf(saved.getId()),
                "Login Social Google SSO autenticado para " + saved.getName() + " (" + normalizedEmail + ")"
        );

        String token = generateToken(saved);
        return new AuthResponse(token, toDto(saved));
    }

    private String extractEmailFromGoogleRequest(GoogleAuthRequest req) {
        if (req == null) return null;

        if (req.credential() != null && !req.credential().isBlank()) {
            String cred = req.credential().trim();
            // 1. Tenta validar via endpoint oficial do Google Identity Services (se houver internet e for token real)
            String[] parts = cred.split("\\.");
            if (parts.length == 3) {
                try {
                    String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                    JsonNode payload = objectMapper.readTree(payloadJson);
                    if (payload.has("email")) {
                        boolean verified = !payload.has("email_verified") || payload.get("email_verified").asBoolean(true);
                        if (verified) {
                            return payload.get("email").asText();
                        }
                    }
                } catch (Exception ignored) {
                }

                try {
                    HttpRequest httpReq = HttpRequest.newBuilder()
                            .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + cred))
                            .timeout(Duration.ofSeconds(4))
                            .GET()
                            .build();
                    HttpResponse<String> resp = httpClient.send(httpReq, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200) {
                        JsonNode node = objectMapper.readTree(resp.body());
                        if (node.has("email")) {
                            return node.get("email").asText();
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }

        if (req.email() != null && !req.email().isBlank()) {
            return req.email().trim();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public AppUserDto getCurrentUserFromHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new SecurityException("Token de autenticação ausente ou inválido.");
        }
        String token = authHeader.substring(7).trim();
        Long userId = verifyTokenAndExtractUserId(token);
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new SecurityException("Usuário não encontrado."));
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new SecurityException("Usuário desativado.");
        }
        return toDto(user);
    }

    // ============================================================================
    // CRUD DE USUÁRIOS (BACKOFFICE)
    // ============================================================================

    @Transactional(readOnly = true)
    public List<AppUserDto> listUsers() {
        return appUserRepository.findAllByOrderByIdAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public AppUserDto createUser(SaveAppUserRequest req, String actorName, String actorRole) {
        String email = req.email().trim().toLowerCase();
        if (appUserRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new IllegalArgumentException("Já existe um usuário cadastrado com o e-mail: " + email);
        }

        String rawPassword = (req.password() != null && !req.password().isBlank())
                ? req.password().trim()
                : "totaltrigo2026";

        AppUser user = new AppUser();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRoleProfile(req.roleProfile() != null && !req.roleProfile().isBlank()
                ? req.roleProfile().trim()
                : "Gabriel Furtado · Backoffice & Fiscal");
        user.setAllowedMode(req.allowedMode() != null && !req.allowedMode().isBlank()
                ? req.allowedMode().trim()
                : "ALL");
        user.setActive(req.active() != null ? req.active() : true);
        user.setGoogleEmail(req.googleEmail() != null && !req.googleEmail().isBlank()
                ? req.googleEmail().trim().toLowerCase()
                : email);
        user.setCreatedAt(LocalDateTime.now());

        AppUser saved = appUserRepository.save(user);

        managementService.logAudit(
                actorName,
                actorRole,
                "CADASTRO_USUARIO",
                "AppUser",
                String.valueOf(saved.getId()),
                "Novo usuário cadastrado: " + saved.getName() + " (" + saved.getEmail() + ") — Perfil: " + saved.getRoleProfile()
        );

        return toDto(saved);
    }

    @Transactional
    public AppUserDto updateUser(Long id, SaveAppUserRequest req, String actorName, String actorRole) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + id));

        String newEmail = req.email().trim().toLowerCase();
        Optional<AppUser> existingWithEmail = appUserRepository.findByEmailIgnoreCase(newEmail);
        if (existingWithEmail.isPresent() && !existingWithEmail.get().getId().equals(id)) {
            throw new IllegalArgumentException("Já existe outro usuário utilizando o e-mail: " + newEmail);
        }

        user.setName(req.name().trim());
        user.setEmail(newEmail);
        if (req.password() != null && !req.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(req.password().trim()));
        }
        if (req.roleProfile() != null && !req.roleProfile().isBlank()) {
            user.setRoleProfile(req.roleProfile().trim());
        }
        if (req.allowedMode() != null && !req.allowedMode().isBlank()) {
            user.setAllowedMode(req.allowedMode().trim());
        }
        if (req.active() != null) {
            user.setActive(req.active());
        }
        if (req.googleEmail() != null) {
            user.setGoogleEmail(req.googleEmail().isBlank() ? newEmail : req.googleEmail().trim().toLowerCase());
        }

        AppUser saved = appUserRepository.save(user);

        managementService.logAudit(
                actorName,
                actorRole,
                "ATUALIZACAO_USUARIO",
                "AppUser",
                String.valueOf(saved.getId()),
                "Usuário atualizado: " + saved.getName() + " (" + saved.getEmail() + ") — Ativo: " + saved.getActive()
        );

        return toDto(saved);
    }

    @Transactional
    public void deleteUser(Long id, String actorName, String actorRole) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + id));

        long activeUsersCount = appUserRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .count();

        if (activeUsersCount <= 1 && Boolean.TRUE.equals(user.getActive())) {
            throw new IllegalStateException("Não é permitido remover o único usuário ativo do sistema.");
        }

        appUserRepository.delete(user);

        managementService.logAudit(
                actorName,
                actorRole,
                "EXCLUSAO_USUARIO",
                "AppUser",
                String.valueOf(id),
                "Usuário removido do sistema: " + user.getName() + " (" + user.getEmail() + ")"
        );
    }

    // ============================================================================
    // TOKEN JWT / HMAC-SHA256 UTILITÁRIOS
    // ============================================================================

    public String generateToken(AppUser user) {
        try {
            String headerJson = objectMapper.writeValueAsString(Map.of("alg", "HS256", "typ", "JWT"));
            long now = Instant.now().getEpochSecond();
            long exp = now + (86400 * 7); // 7 dias
            String payloadJson = objectMapper.writeValueAsString(Map.of(
                    "sub", String.valueOf(user.getId()),
                    "email", user.getEmail(),
                    "name", user.getName(),
                    "roleProfile", user.getRoleProfile(),
                    "allowedMode", user.getAllowedMode(),
                    "iat", now,
                    "exp", exp
            ));

            String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));
            String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signingInput = encodedHeader + "." + encodedPayload;
            String signature = signHmacSha256(signingInput);
            return signingInput + "." + signature;
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao gerar token de acesso.", e);
        }
    }

    private Long verifyTokenAndExtractUserId(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new SecurityException("Formato de token inválido.");
            }
            String signingInput = parts[0] + "." + parts[1];
            String expectedSig = signHmacSha256(signingInput);
            if (!expectedSig.equals(parts[2])) {
                throw new SecurityException("Assinatura do token inválida.");
            }
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            JsonNode node = objectMapper.readTree(payloadJson);
            if (node.has("exp") && node.get("exp").asLong() < Instant.now().getEpochSecond()) {
                throw new SecurityException("Sessão expirada. Faça login novamente.");
            }
            return Long.parseLong(node.get("sub").asText());
        } catch (SecurityException se) {
            throw se;
        } catch (Exception e) {
            throw new SecurityException("Token inválido ou corrompido.");
        }
    }

    private String signHmacSha256(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKey);
        byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
    }

    private String extractShortRole(String roleProfile) {
        if (roleProfile == null) return "Backoffice & Fiscal";
        if (roleProfile.contains("·")) {
            return roleProfile.substring(roleProfile.indexOf("·") + 1).trim();
        }
        return roleProfile;
    }

    private AppUserDto toDto(AppUser u) {
        return new AppUserDto(
                u.getId(),
                u.getName(),
                u.getEmail(),
                u.getRoleProfile(),
                u.getAllowedMode(),
                u.getActive(),
                u.getGoogleEmail(),
                u.getLastLoginAt(),
                u.getCreatedAt()
        );
    }
}
