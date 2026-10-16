package br.com.totaltrigo.erp.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku_code", nullable = false, unique = true)
    private String skuCode;

    @Column(name = "erp_code", nullable = false)
    private String erpCode;

    @Column(nullable = false)
    private String name;

    @Column(name = "short_name", nullable = false)
    private String shortName;

    @Column(name = "unit_of_measure", nullable = false)
    private String unitOfMeasure = "SA";

    @Column(name = "units_per_box", nullable = false)
    private Integer unitsPerBox = 5;

    @Column(name = "physical_stock", nullable = false)
    private Integer physicalStock = 0;

    @Column(name = "reserved_stock", nullable = false)
    private Integer reservedStock = 0;

    @Column(name = "current_landed_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal currentLandedCost;

    @Column(name = "base_list_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseListPrice;

    @Column(nullable = false, length = 8)
    private String ncm;

    @Column(length = 10)
    private String cest;

    @Column(name = "c_benef", length = 20)
    private String cBenef;

    @Column(name = "origin_code", nullable = false)
    private Integer originCode = 1;

    @Column(name = "default_cfop_internal", nullable = false, length = 4)
    private String defaultCfopInternal = "5102";

    @Column(name = "default_cfop_interstate", nullable = false, length = 4)
    private String defaultCfopInterstate = "6102";

    @Column(name = "estimated_tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal estimatedTaxRate = new BigDecimal("8.00");

    @Transient
    public Integer getAvailableStock() {
        return Math.max(0, (physicalStock != null ? physicalStock : 0) - (reservedStock != null ? reservedStock : 0));
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSkuCode() { return skuCode; }
    public void setSkuCode(String skuCode) { this.skuCode = skuCode; }
    public String getErpCode() { return erpCode; }
    public void setErpCode(String erpCode) { this.erpCode = erpCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getShortName() { return shortName; }
    public void setShortName(String shortName) { this.shortName = shortName; }
    public String getUnitOfMeasure() { return unitOfMeasure; }
    public void setUnitOfMeasure(String unitOfMeasure) { this.unitOfMeasure = unitOfMeasure; }
    public Integer getUnitsPerBox() { return unitsPerBox; }
    public void setUnitsPerBox(Integer unitsPerBox) { this.unitsPerBox = unitsPerBox; }
    public Integer getPhysicalStock() { return physicalStock; }
    public void setPhysicalStock(Integer physicalStock) { this.physicalStock = physicalStock; }
    public Integer getReservedStock() { return reservedStock; }
    public void setReservedStock(Integer reservedStock) { this.reservedStock = reservedStock; }
    public BigDecimal getCurrentLandedCost() { return currentLandedCost; }
    public void setCurrentLandedCost(BigDecimal currentLandedCost) { this.currentLandedCost = currentLandedCost; }
    public BigDecimal getBaseListPrice() { return baseListPrice; }
    public void setBaseListPrice(BigDecimal baseListPrice) { this.baseListPrice = baseListPrice; }
    public String getNcm() { return ncm; }
    public void setNcm(String ncm) { this.ncm = ncm; }
    public String getCest() { return cest; }
    public void setCest(String cest) { this.cest = cest; }
    public String getcBenef() { return cBenef; }
    public void setcBenef(String cBenef) { this.cBenef = cBenef; }
    public Integer getOriginCode() { return originCode; }
    public void setOriginCode(Integer originCode) { this.originCode = originCode; }
    public String getDefaultCfopInternal() { return defaultCfopInternal; }
    public void setDefaultCfopInternal(String defaultCfopInternal) { this.defaultCfopInternal = defaultCfopInternal; }
    public String getDefaultCfopInterstate() { return defaultCfopInterstate; }
    public void setDefaultCfopInterstate(String defaultCfopInterstate) { this.defaultCfopInterstate = defaultCfopInterstate; }
    public BigDecimal getEstimatedTaxRate() { return estimatedTaxRate; }
    public void setEstimatedTaxRate(BigDecimal estimatedTaxRate) { this.estimatedTaxRate = estimatedTaxRate; }
}
