package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attendance_review_events")
public class AttendanceReviewEvent {
    @Id UUID id;
    @Column(nullable = false) UUID sessionId;
    @ManyToOne(optional = false) @JoinColumn(name = "student_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE) Student student;
    @ManyToOne @JoinColumn(name = "actor_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.SET_NULL) Teacher actor;
    @Column(nullable = false, length = 40) String action;
    @Column(length = 20) String previousStatus;
    @Column(nullable = false, length = 20) String resultingStatus;
    @Column(nullable = false) Instant occurredAt;
}
