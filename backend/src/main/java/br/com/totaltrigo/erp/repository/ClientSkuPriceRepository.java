package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.ClientSkuPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ClientSkuPriceRepository extends JpaRepository<ClientSkuPrice, Long> {
    List<ClientSkuPrice> findByClientIdOrderByProductIdAsc(Long clientId);
    Optional<ClientSkuPrice> findByClientIdAndProductId(Long clientId, Long productId);
}
