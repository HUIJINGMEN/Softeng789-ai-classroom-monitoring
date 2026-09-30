package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Resolves and validates the domain context shared by AI-generated classroom observations.
 *
 * <p>Keeping this rule in one place prevents behaviour and health pipelines from accepting
 * different student/session combinations as additional AI providers are introduced.</p>
 */
@Component
public class AiObservationContextResolver {
    private final ClassroomSessionRepository sessionRepository;
    private final StudentRepository studentRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    public AiObservationContextResolver(
            ClassroomSessionRepository sessionRepository,
            StudentRepository studentRepository,
            CourseEnrollmentRepository enrollmentRepository
    ) {
        this.sessionRepository = sessionRepository;
        this.studentRepository = studentRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public ObservationContext resolveCandidate(UUID sessionId, UUID studentId) {
        ClassroomSession session = requireSessionWithOffering(sessionId);
        Student student = studentId == null ? null : requireActiveStudent(studentId, session);
        return new ObservationContext(session, student);
    }

    public ObservationContext resolveIdentified(UUID sessionId, UUID studentId) {
        if (studentId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "A recognized student is required.");
        }
        return resolveCandidate(sessionId, studentId);
    }

    private ClassroomSession requireSessionWithOffering(UUID sessionId) {
        ClassroomSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
        if (session.getCourseOffering() == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "The classroom session is not linked to a class offering.");
        }
        return session;
    }

    private Student requireActiveStudent(UUID studentId, ClassroomSession session) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        boolean activelyEnrolled = enrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                studentId,
                session.getCourseOffering().getId(),
                CourseEnrollment.EnrollmentStatus.ACTIVE
        );
        if (!activelyEnrolled) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "The recognized student is not actively enrolled in this session's class.");
        }
        return student;
    }

    public record ObservationContext(ClassroomSession session, Student student) {
    }
}
