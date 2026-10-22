package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Attendance decisions only; no photos, embeddings, scores or absence notes. */
@Service
public class AttendanceReviewHistory {
    private final EntityManager em;
    public AttendanceReviewHistory(EntityManager em) { this.em = em; }
    public record Entry(UUID id, UUID studentId, String studentName, String actorName, String action,
            String previousStatus, String resultingStatus, Instant occurredAt) {}

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID session, UUID student, UUID actor, String action, String previous, String result) {
        var event = new AttendanceReviewEvent(); event.id = UUID.randomUUID(); event.sessionId = session;
        event.student = em.getReference(Student.class, student);
        event.actor = actor == null ? null : em.getReference(Teacher.class, actor);
        event.action = action; event.previousStatus = previous; event.resultingStatus = result; event.occurredAt = Instant.now();
        em.persist(event);
    }
    @Transactional(readOnly = true)
    public List<Entry> recent(UUID session) {
        return em.createQuery("select e from AttendanceReviewEvent e join fetch e.student left join fetch e.actor "
                        + "where e.sessionId = :session order by e.occurredAt desc, e.id desc", AttendanceReviewEvent.class)
                .setParameter("session", session).setMaxResults(100).getResultList().stream()
                .map(e -> new Entry(e.id, e.student.getId(), e.student.getFullName(), e.actor == null ? "Unavailable" : e.actor.getName(),
                        e.action, e.previousStatus, e.resultingStatus, e.occurredAt)).toList();
    }
}
