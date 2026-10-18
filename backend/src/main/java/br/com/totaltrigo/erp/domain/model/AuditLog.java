package br.com.totaltrigo.erp.domain.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_name", nullable = false, length = 100)
    private String actorName;

    @Column(name = "actor_role", nullable = false, length = 60)
    private String actorRole;

    @Column(name = "action_type", nullable = false, length = 60)
    private String actionType;

    @Column(name = "target_entity", nullable = false, length = 60)
    private String targetEntity;

    @Column(name = "target_id", length = 60)
    private String targetId;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public AuditLog() {
    }

    public AuditLog(String actorName, String actorRole, String actionType, String targetEntity, String targetId, String summary) {
        this.actorName = actorName != null ? actorName : "Gabriel Furtado";
        this.actorRole = actorRole != null ? actorRole : "Backoffice & Fiscal";
        this.actionType = actionType;
        this.targetEntity = targetEntity;
        this.targetId = targetId;
        this.summary = summary;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getTargetEntity() { return targetEntity; }
    public void setTargetEntity(String targetEntity) { this.targetEntity = targetEntity; }

    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
