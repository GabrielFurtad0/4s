package br.com.totaltrigo.erp.domain.model;

import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.AGUARDANDO_REVISAO;

    @Column(name = "payment_terms", nullable = false, length = 60)
    private String paymentTerms;

    @Column(name = "delivery_forecast", length = 80)
    private String deliveryForecast;

    @Column(name = "notes_for_invoice_or_driver", length = 500)
    private String notesForInvoiceOrDriver;

    @Column(name = "backoffice_adjustment_notes", length = 500)
    private String backofficeAdjustmentNotes;

    @Column(name = "shipping_cost_estimate", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingCostEstimate = BigDecimal.ZERO;

    @Column(name = "original_commercial_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal originalCommercialTotal = BigDecimal.ZERO;

    @Column(name = "gross_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossTotal = BigDecimal.ZERO;

    @Column(name = "total_cmv_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCmvSnapshot = BigDecimal.ZERO;

    @Column(name = "estimated_tax_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal estimatedTaxSnapshot = BigDecimal.ZERO;

    @Column(name = "net_profit_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal netProfitSnapshot = BigDecimal.ZERO;

    @Column(name = "net_margin_percentage", nullable = false, precision = 6, scale = 2)
    private BigDecimal netMarginPercentage = BigDecimal.ZERO;

    @Embedded
    private InvoiceData invoiceData = new InvoiceData();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        this.items.add(item);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public String getPaymentTerms() { return paymentTerms; }
    public void setPaymentTerms(String paymentTerms) { this.paymentTerms = paymentTerms; }
    public String getDeliveryForecast() { return deliveryForecast; }
    public void setDeliveryForecast(String deliveryForecast) { this.deliveryForecast = deliveryForecast; }
    public String getNotesForInvoiceOrDriver() { return notesForInvoiceOrDriver; }
    public void setNotesForInvoiceOrDriver(String notesForInvoiceOrDriver) { this.notesForInvoiceOrDriver = notesForInvoiceOrDriver; }
    public String getBackofficeAdjustmentNotes() { return backofficeAdjustmentNotes; }
    public void setBackofficeAdjustmentNotes(String backofficeAdjustmentNotes) { this.backofficeAdjustmentNotes = backofficeAdjustmentNotes; }
    public BigDecimal getShippingCostEstimate() { return shippingCostEstimate; }
    public void setShippingCostEstimate(BigDecimal shippingCostEstimate) { this.shippingCostEstimate = shippingCostEstimate; }
    public BigDecimal getOriginalCommercialTotal() { return originalCommercialTotal; }
    public void setOriginalCommercialTotal(BigDecimal originalCommercialTotal) { this.originalCommercialTotal = originalCommercialTotal; }
    public BigDecimal getGrossTotal() { return grossTotal; }
    public void setGrossTotal(BigDecimal grossTotal) { this.grossTotal = grossTotal; }
    public BigDecimal getTotalCmvSnapshot() { return totalCmvSnapshot; }
    public void setTotalCmvSnapshot(BigDecimal totalCmvSnapshot) { this.totalCmvSnapshot = totalCmvSnapshot; }
    public BigDecimal getEstimatedTaxSnapshot() { return estimatedTaxSnapshot; }
    public void setEstimatedTaxSnapshot(BigDecimal estimatedTaxSnapshot) { this.estimatedTaxSnapshot = estimatedTaxSnapshot; }
    public BigDecimal getNetProfitSnapshot() { return netProfitSnapshot; }
    public void setNetProfitSnapshot(BigDecimal netProfitSnapshot) { this.netProfitSnapshot = netProfitSnapshot; }
    public BigDecimal getNetMarginPercentage() { return netMarginPercentage; }
    public void setNetMarginPercentage(BigDecimal netMarginPercentage) { this.netMarginPercentage = netMarginPercentage; }
    public InvoiceData getInvoiceData() {
        if (invoiceData == null) invoiceData = new InvoiceData();
        return invoiceData;
    }
    public void setInvoiceData(InvoiceData invoiceData) { this.invoiceData = invoiceData; }
    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }
}
