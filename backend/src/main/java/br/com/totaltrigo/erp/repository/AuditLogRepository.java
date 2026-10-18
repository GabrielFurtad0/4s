package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findAllByOrderByCreatedAtDesc();
    List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
