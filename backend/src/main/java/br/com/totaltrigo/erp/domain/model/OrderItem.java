package br.com.totaltrigo.erp.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "ordered_quantity", nullable = false)
    private Integer orderedQuantity;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "ordered_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal orderedUnitPrice;

    @Column(name = "unit_sale_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitSalePrice;

    @Column(name = "unit_cost_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCostSnapshot;

    @Column(name = "is_promotional_price", nullable = false)
    private boolean isPromotionalPrice = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public Integer getOrderedQuantity() { return orderedQuantity; }
    public void setOrderedQuantity(Integer orderedQuantity) { this.orderedQuantity = orderedQuantity; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getOrderedUnitPrice() { return orderedUnitPrice; }
    public void setOrderedUnitPrice(BigDecimal orderedUnitPrice) { this.orderedUnitPrice = orderedUnitPrice; }
    public BigDecimal getUnitSalePrice() { return unitSalePrice; }
    public void setUnitSalePrice(BigDecimal unitSalePrice) { this.unitSalePrice = unitSalePrice; }
    public BigDecimal getUnitCostSnapshot() { return unitCostSnapshot; }
    public void setUnitCostSnapshot(BigDecimal unitCostSnapshot) { this.unitCostSnapshot = unitCostSnapshot; }
    public boolean isPromotionalPrice() { return isPromotionalPrice; }
    public void setPromotionalPrice(boolean promotionalPrice) { isPromotionalPrice = promotionalPrice; }
}
