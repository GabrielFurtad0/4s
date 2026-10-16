package br.com.totaltrigo.erp.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "client_sku_prices")
public class ClientSkuPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "last_practiced_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal lastPracticedPrice;

    @Column(name = "agreed_standard_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal agreedStandardPrice;

    @Column(name = "last_order_date")
    private LocalDate lastOrderDate;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public BigDecimal getLastPracticedPrice() { return lastPracticedPrice; }
    public void setLastPracticedPrice(BigDecimal lastPracticedPrice) { this.lastPracticedPrice = lastPracticedPrice; }
    public BigDecimal getAgreedStandardPrice() { return agreedStandardPrice; }
    public void setAgreedStandardPrice(BigDecimal agreedStandardPrice) { this.agreedStandardPrice = agreedStandardPrice; }
    public LocalDate getLastOrderDate() { return lastOrderDate; }
    public void setLastOrderDate(LocalDate lastOrderDate) { this.lastOrderDate = lastOrderDate; }
}
