package br.com.totaltrigo.erp.repository;

import br.com.totaltrigo.erp.domain.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findBySkuCode(String skuCode);
    List<Product> findAllByOrderByIdAsc();
}
