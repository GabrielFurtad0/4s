package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.VisitSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface VisitScheduleRepository extends JpaRepository<VisitSchedule, Long> {
    List<VisitSchedule> findByScheduledDateOrderByScheduledTimeAsc(LocalDate scheduledDate);
    List<VisitSchedule> findByClientIdOrderByScheduledDateDescScheduledTimeAsc(Long clientId);
}
