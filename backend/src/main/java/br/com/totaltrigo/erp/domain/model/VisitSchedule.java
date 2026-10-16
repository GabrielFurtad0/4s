package br.com.totaltrigo.erp.domain.model;

import br.com.totaltrigo.erp.domain.enums.VisitStatus;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "visit_schedules")
public class VisitSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate = LocalDate.now();

    @Column(name = "scheduled_time", nullable = false, length = 10)
    private String scheduledTime;

    @Column(name = "reminder_note", length = 300)
    private String reminderNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VisitStatus status = VisitStatus.PENDENTE;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }
    public String getReminderNote() { return reminderNote; }
    public void setReminderNote(String reminderNote) { this.reminderNote = reminderNote; }
    public VisitStatus getStatus() { return status; }
    public void setStatus(VisitStatus status) { this.status = status; }
}
