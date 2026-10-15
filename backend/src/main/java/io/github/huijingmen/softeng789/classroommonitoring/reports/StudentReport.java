package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A frozen evidence snapshot with separately reviewed narratives; never writes source records. */
@Entity
@Table(name = "student_reports")
public class StudentReport {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false) private UUID studentId;
    @Column(nullable = false) private UUID createdById;
    @Column(nullable = false, length = 64) private String scopeKey;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant publishedAt;
    @Version private Long version;
    public UUID getId() { return id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID value) { studentId = value; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID value) { createdById = value; }
    public String getScopeKey() { return scopeKey; }
    public void setScopeKey(String value) { scopeKey = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant value) { publishedAt = value; }
    public Long getVersion() { return version; }
}
