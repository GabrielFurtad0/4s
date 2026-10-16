package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import br.com.totaltrigo.erp.domain.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByClientIdOrderByCreatedAtDesc(Long clientId);
    List<Order> findByStatusInOrderByCreatedAtDesc(List<OrderStatus> statuses);
    List<Order> findAllByOrderByCreatedAtDesc();
    long countByStatus(OrderStatus status);
}
