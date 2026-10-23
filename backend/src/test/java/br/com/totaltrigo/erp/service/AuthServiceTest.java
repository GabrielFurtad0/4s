package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.domain.model.AppUser;
import br.com.totaltrigo.erp.dto.ApiDtos.*;
import br.com.totaltrigo.erp.repository.AppUserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:totaltrigo_test_db;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
@Transactional
class AuthServiceTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private AppUserRepository appUserRepository;

    @Test
    @DisplayName("Deve autenticar usuário inicial com e-mail e senha e converter hash para BCrypt")
    void shouldLoginInitialUserWithEmailAndPasswordAndConvertToBCrypt() {
        AuthResponse response = authService.loginWithPassword(
                new LoginRequest("gabriel@totaltrigo.com.br", "totaltrigo2026")
        );

        assertNotNull(response);
        assertNotNull(response.token());
        assertEquals("Gabriel Furtado", response.user().name());
        assertEquals("gabriel@totaltrigo.com.br", response.user().email());

        AppUser userInDb = appUserRepository.findByEmailIgnoreCase("gabriel@totaltrigo.com.br").orElseThrow();
        assertTrue(userInDb.getPasswordHash().startsWith("$2a$"));

        AppUserDto currentUser = authService.getCurrentUserFromHeader("Bearer " + response.token());
        assertEquals("Gabriel Furtado", currentUser.name());
    }

    @Test
    @DisplayName("Deve autenticar via Google SSO apenas se o e-mail estiver previamente cadastrado no Backoffice")
    void shouldLoginWithGoogleOnlyForRegisteredEmails() {
        AuthResponse okResponse = authService.loginWithGoogle(
                new GoogleAuthRequest(null, "sergio@totaltrigo.com.br", "Sérgio Soares")
        );
        assertNotNull(okResponse);
        assertEquals("Sérgio Soares", okResponse.user().name());

        SecurityException ex = assertThrows(SecurityException.class, () ->
                authService.loginWithGoogle(new GoogleAuthRequest(null, "intruso@gmail.com", "Intruso"))
        );
        assertTrue(ex.getMessage().contains("não está autorizada"));
    }

    @Test
    @DisplayName("Deve criar, atualizar e listar usuários no Backoffice")
    void shouldCrudUsersInBackoffice() {
        List<AppUserDto> initialUsers = authService.listUsers();
        assertTrue(initialUsers.size() >= 3);

        AppUserDto created = authService.createUser(
                new SaveAppUserRequest(
                        "Novo Operador Fiscal",
                        "fiscal2@totaltrigo.com.br",
                        "senhaForte123",
                        "Gabriel Furtado · Backoffice & Fiscal",
                        "DESKTOP_ONLY",
                        true,
                        "fiscal2@gmail.com"
                ),
                "Gabriel Furtado",
                "Backoffice & Fiscal"
        );

        assertNotNull(created.id());
        assertEquals("fiscal2@totaltrigo.com.br", created.email());

        // Testa login com a senha recém-criada em BCrypt
        AuthResponse loginCreated = authService.loginWithPassword(
                new LoginRequest("fiscal2@totaltrigo.com.br", "senhaForte123")
        );
        assertNotNull(loginCreated.token());

        // Testa login Google com o googleEmail vinculado
        AuthResponse googleCreated = authService.loginWithGoogle(
                new GoogleAuthRequest(null, "fiscal2@gmail.com", "Novo Operador Fiscal")
        );
        assertEquals(created.id(), googleCreated.user().id());
    }
}
