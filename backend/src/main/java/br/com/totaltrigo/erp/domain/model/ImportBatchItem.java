package br.com.totaltrigo.erp.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "import_batch_items")
public class ImportBatchItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ImportBatch batch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity_imported", nullable = false)
    private Integer quantityImported;

    @Column(name = "fob_unit_usd", nullable = false, precision = 12, scale = 2)
    private BigDecimal fobUnitUsd;

    @Column(name = "calculated_unit_cost_brl", nullable = false, precision = 12, scale = 2)
    private BigDecimal calculatedUnitCostBrl;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ImportBatch getBatch() { return batch; }
    public void setBatch(ImportBatch batch) { this.batch = batch; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public Integer getQuantityImported() { return quantityImported; }
    public void setQuantityImported(Integer quantityImported) { this.quantityImported = quantityImported; }
    public BigDecimal getFobUnitUsd() { return fobUnitUsd; }
    public void setFobUnitUsd(BigDecimal fobUnitUsd) { this.fobUnitUsd = fobUnitUsd; }
    public BigDecimal getCalculatedUnitCostBrl() { return calculatedUnitCostBrl; }
    public void setCalculatedUnitCostBrl(BigDecimal calculatedUnitCostBrl) { this.calculatedUnitCostBrl = calculatedUnitCostBrl; }
}
