package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmailIgnoreCase(String email);
    Optional<AppUser> findByGoogleEmailIgnoreCase(String googleEmail);
    List<AppUser> findAllByOrderByIdAsc();
}
