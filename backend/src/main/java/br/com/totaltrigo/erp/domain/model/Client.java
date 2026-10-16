package br.com.totaltrigo.erp.domain.model;

import br.com.totaltrigo.erp.domain.enums.FinancialStatus;
import br.com.totaltrigo.erp.domain.enums.IeIndicator;
import br.com.totaltrigo.erp.domain.enums.PurchaseProfile;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "clients")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corporate_name", nullable = false)
    private String corporateName;

    @Column(name = "trade_name")
    private String tradeName;

    @Column(length = 18)
    private String cnpj;

    @Column(name = "state_registration", length = 30)
    private String stateRegistration;

    @Enumerated(EnumType.STRING)
    @Column(name = "ie_indicator", nullable = false)
    private IeIndicator ieIndicator = IeIndicator.CONTRIBUINTE;

    @Enumerated(EnumType.STRING)
    @Column(name = "purchase_profile", nullable = false)
    private PurchaseProfile purchaseProfile = PurchaseProfile.INDUSTRIALIZACAO;

    @Column(name = "zip_code", length = 12)
    private String zipCode;

    @Column(length = 160)
    private String street;

    @Column(length = 20)
    private String number;

    @Column(length = 60)
    private String complement;

    @Column(length = 80)
    private String neighborhood;

    @Column(length = 80)
    private String city = "São Paulo";

    @Column(length = 2)
    private String state = "SP";

    @Column(name = "ibge_city_code", length = 7)
    private String ibgeCityCode;

    @Column(name = "contact_name", length = 80)
    private String contactName;

    @Column(length = 30)
    private String phone;

    @Column(name = "default_payment_terms", length = 60)
    private String defaultPaymentTerms = "Boleto 28 dias";

    @Column(name = "average_purchase_cycle_days", nullable = false)
    private Integer averagePurchaseCycleDays = 20;

    @Column(name = "last_purchase_date")
    private LocalDate lastPurchaseDate;

    @Column(name = "last_order_total", precision = 12, scale = 2)
    private BigDecimal lastOrderTotal = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "financial_status", nullable = false)
    private FinancialStatus financialStatus = FinancialStatus.EM_DIA;

    @Column(name = "is_registration_complete", nullable = false)
    private boolean isRegistrationComplete = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCorporateName() { return corporateName; }
    public void setCorporateName(String corporateName) { this.corporateName = corporateName; }
    public String getTradeName() { return tradeName; }
    public void setTradeName(String tradeName) { this.tradeName = tradeName; }
    public String getCnpj() { return cnpj; }
    public void setCnpj(String cnpj) { this.cnpj = cnpj; }
    public String getStateRegistration() { return stateRegistration; }
    public void setStateRegistration(String stateRegistration) { this.stateRegistration = stateRegistration; }
    public IeIndicator getIeIndicator() { return ieIndicator; }
    public void setIeIndicator(IeIndicator ieIndicator) { this.ieIndicator = ieIndicator; }
    public PurchaseProfile getPurchaseProfile() { return purchaseProfile; }
    public void setPurchaseProfile(PurchaseProfile purchaseProfile) { this.purchaseProfile = purchaseProfile; }
    public String getZipCode() { return zipCode; }
    public void setZipCode(String zipCode) { this.zipCode = zipCode; }
    public String getStreet() { return street; }
    public void setStreet(String street) { this.street = street; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getComplement() { return complement; }
    public void setComplement(String complement) { this.complement = complement; }
    public String getNeighborhood() { return neighborhood; }
    public void setNeighborhood(String neighborhood) { this.neighborhood = neighborhood; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getIbgeCityCode() { return ibgeCityCode; }
    public void setIbgeCityCode(String ibgeCityCode) { this.ibgeCityCode = ibgeCityCode; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDefaultPaymentTerms() { return defaultPaymentTerms; }
    public void setDefaultPaymentTerms(String defaultPaymentTerms) { this.defaultPaymentTerms = defaultPaymentTerms; }
    public Integer getAveragePurchaseCycleDays() { return averagePurchaseCycleDays; }
    public void setAveragePurchaseCycleDays(Integer averagePurchaseCycleDays) { this.averagePurchaseCycleDays = averagePurchaseCycleDays; }
    public LocalDate getLastPurchaseDate() { return lastPurchaseDate; }
    public void setLastPurchaseDate(LocalDate lastPurchaseDate) { this.lastPurchaseDate = lastPurchaseDate; }
    public BigDecimal getLastOrderTotal() { return lastOrderTotal; }
    public void setLastOrderTotal(BigDecimal lastOrderTotal) { this.lastOrderTotal = lastOrderTotal; }
    public FinancialStatus getFinancialStatus() { return financialStatus; }
    public void setFinancialStatus(FinancialStatus financialStatus) { this.financialStatus = financialStatus; }
    public boolean isRegistrationComplete() { return isRegistrationComplete; }
    public void setRegistrationComplete(boolean registrationComplete) { isRegistrationComplete = registrationComplete; }
}
