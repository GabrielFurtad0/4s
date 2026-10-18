package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.ReceivableTitle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ReceivableTitleRepository extends JpaRepository<ReceivableTitle, Long> {
    List<ReceivableTitle> findAllByOrderByDueDateAsc();
    List<ReceivableTitle> findByClientIdOrderByDueDateAsc(Long clientId);
    List<ReceivableTitle> findByOrderId(Long orderId);
    List<ReceivableTitle> findByStatusOrderByDueDateAsc(String status);
    long countByClientIdAndStatusInAndDueDateBefore(Long clientId, List<String> statuses, LocalDate date);
    long countByClientIdAndStatus(Long clientId, String status);
}
