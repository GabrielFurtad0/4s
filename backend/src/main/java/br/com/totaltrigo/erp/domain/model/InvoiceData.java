package br.com.totaltrigo.erp.domain.model;

import br.com.totaltrigo.erp.domain.enums.NfeStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Embeddable
public class InvoiceData {

    @Enumerated(EnumType.STRING)
    @Column(name = "nfe_status")
    private NfeStatus nfeStatus = NfeStatus.PENDENTE;

    @Column(name = "nfe_number", length = 20)
    private String nfeNumber;

    @Column(name = "nfe_access_key", length = 44)
    private String nfeAccessKey;

    @Column(name = "danfe_pdf_url")
    private String danfePdfUrl;

    @Column(name = "xml_url")
    private String xmlUrl;

    @Column(name = "sefaz_rejection_message", length = 500)
    private String sefazRejectionMessage;

    public NfeStatus getNfeStatus() { return nfeStatus; }
    public void setNfeStatus(NfeStatus nfeStatus) { this.nfeStatus = nfeStatus; }
    public String getNfeNumber() { return nfeNumber; }
    public void setNfeNumber(String nfeNumber) { this.nfeNumber = nfeNumber; }
    public String getNfeAccessKey() { return nfeAccessKey; }
    public void setNfeAccessKey(String nfeAccessKey) { this.nfeAccessKey = nfeAccessKey; }
    public String getDanfePdfUrl() { return danfePdfUrl; }
    public void setDanfePdfUrl(String danfePdfUrl) { this.danfePdfUrl = danfePdfUrl; }
    public String getXmlUrl() { return xmlUrl; }
    public void setXmlUrl(String xmlUrl) { this.xmlUrl = xmlUrl; }
    public String getSefazRejectionMessage() { return sefazRejectionMessage; }
    public void setSefazRejectionMessage(String sefazRejectionMessage) { this.sefazRejectionMessage = sefazRejectionMessage; }
}
