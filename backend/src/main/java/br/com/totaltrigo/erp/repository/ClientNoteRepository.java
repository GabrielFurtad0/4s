package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.ClientNote;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClientNoteRepository extends JpaRepository<ClientNote, Long> {
    List<ClientNote> findByClientIdOrderByCreatedAtDesc(Long clientId);
}
