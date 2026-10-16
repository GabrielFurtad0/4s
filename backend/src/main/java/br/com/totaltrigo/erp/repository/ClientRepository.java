package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {
    Optional<Client> findByCnpj(String cnpj);
    List<Client> findAllByOrderByCorporateNameAsc();
}
