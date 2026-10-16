package br.com.totaltrigo.erp.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_code", nullable = false, unique = true)
    private String batchCode;

    @Column(name = "arrival_date", nullable = false)
    private LocalDate arrivalDate;

    @Column(name = "supplier_name")
    private String supplierName;

    @Column(name = "exchange_rate_usd", nullable = false, precision = 10, scale = 4)
    private BigDecimal exchangeRateUsd;

    @Column(name = "fob_total_usd", nullable = false, precision = 14, scale = 2)
    private BigDecimal fobTotalUsd;

    @Column(name = "international_freight_brl", nullable = false, precision = 14, scale = 2)
    private BigDecimal internationalFreightBrl;

    @Column(name = "import_taxes_brl", nullable = false, precision = 14, scale = 2)
    private BigDecimal importTaxesBrl;

    @Column(name = "customs_expenses_brl", nullable = false, precision = 14, scale = 2)
    private BigDecimal customsExpensesBrl;

    @Column(name = "total_landed_cost_brl", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalLandedCostBrl;

    @Column(length = 500)
    private String notes;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<ImportBatchItem> items = new ArrayList<>();

    public void addItem(ImportBatchItem item) {
        item.setBatch(this);
        this.items.add(item);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }
    public LocalDate getArrivalDate() { return arrivalDate; }
    public void setArrivalDate(LocalDate arrivalDate) { this.arrivalDate = arrivalDate; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }
    public BigDecimal getExchangeRateUsd() { return exchangeRateUsd; }
    public void setExchangeRateUsd(BigDecimal exchangeRateUsd) { this.exchangeRateUsd = exchangeRateUsd; }
    public BigDecimal getFobTotalUsd() { return fobTotalUsd; }
    public void setFobTotalUsd(BigDecimal fobTotalUsd) { this.fobTotalUsd = fobTotalUsd; }
    public BigDecimal getInternationalFreightBrl() { return internationalFreightBrl; }
    public void setInternationalFreightBrl(BigDecimal internationalFreightBrl) { this.internationalFreightBrl = internationalFreightBrl; }
    public BigDecimal getImportTaxesBrl() { return importTaxesBrl; }
    public void setImportTaxesBrl(BigDecimal importTaxesBrl) { this.importTaxesBrl = importTaxesBrl; }
    public BigDecimal getCustomsExpensesBrl() { return customsExpensesBrl; }
    public void setCustomsExpensesBrl(BigDecimal customsExpensesBrl) { this.customsExpensesBrl = customsExpensesBrl; }
    public BigDecimal getTotalLandedCostBrl() { return totalLandedCostBrl; }
    public void setTotalLandedCostBrl(BigDecimal totalLandedCostBrl) { this.totalLandedCostBrl = totalLandedCostBrl; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public List<ImportBatchItem> getItems() { return items; }
    public void setItems(List<ImportBatchItem> items) { this.items = items; }
}
