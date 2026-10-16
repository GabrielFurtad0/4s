package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.ImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {
    List<ImportBatch> findAllByOrderByArrivalDateDescIdDesc();
}
