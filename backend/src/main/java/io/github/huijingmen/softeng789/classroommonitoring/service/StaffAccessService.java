package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Central authorization boundary for resources owned through a class. Controllers resolve the
 * signed-in staff id once, then delegate ownership checks here instead of duplicating repository
 * queries or treating every teacher as institution-wide staff.
 */
@Service
public class StaffAccessService {
    private final TeacherScopeSupport teacherScopeSupport;
    private final CourseOfferingRepository courseOfferingRepository;
    private final ClassroomSessionRepository classroomSessionRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;

    public StaffAccessService(
            TeacherScopeSupport teacherScopeSupport,
            CourseOfferingRepository courseOfferingRepository,
            ClassroomSessionRepository classroomSessionRepository,
            CourseEnrollmentRepository courseEnrollmentRepository
    ) {
        this.teacherScopeSupport = teacherScopeSupport;
        this.courseOfferingRepository = courseOfferingRepository;
        this.classroomSessionRepository = classroomSessionRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
    }

    @Transactional(readOnly = true)
    public void requireOfferingAccess(UUID callerId, UUID offeringId) {
        Teacher caller = teacherScopeSupport.requireCaller(callerId);
        CourseOffering offering = courseOfferingRepository.findById(offeringId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        teacherScopeSupport.assertCanAccessOffering(offering, caller);
    }

    @Transactional(readOnly = true)
    public void requireSessionAccess(UUID callerId, UUID sessionId) {
        Teacher caller = teacherScopeSupport.requireCaller(callerId);
        ClassroomSession session = classroomSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
        assertCanAccessSession(caller, session);
    }

    @Transactional(readOnly = true)
    public void requireSessionAccess(UUID callerId, Collection<UUID> sessionIds) {
        Teacher caller = teacherScopeSupport.requireCaller(callerId);
        List<UUID> requestedIds = sessionIds.stream().distinct().toList();
        List<ClassroomSession> sessions = classroomSessionRepository.findByIdIn(requestedIds);
        if (sessions.size() != requestedIds.size()) {
            throw new ResponseStatusException(NOT_FOUND, "One or more classroom sessions were not found.");
        }
        sessions.forEach(session -> assertCanAccessSession(caller, session));
    }

    private void assertCanAccessSession(Teacher caller, ClassroomSession session) {
        if (teacherScopeSupport.isAdmin(caller)) {
            return;
        }
        if (session.getCourseOffering() != null) {
            teacherScopeSupport.assertCanAccessOffering(session.getCourseOffering(), caller);
            return;
        }
        if (session.getTeacher() == null || !session.getTeacher().getId().equals(caller.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "You can only access sessions for your own classes.");
        }
    }

    @Transactional(readOnly = true)
    public void requireStudentAccess(UUID callerId, UUID studentId) {
        Teacher caller = teacherScopeSupport.requireCaller(callerId);
        if (teacherScopeSupport.isAdmin(caller)) {
            return;
        }
        boolean teachesStudent = courseEnrollmentRepository
                .existsByStudent_IdAndCourseOffering_Teachers_IdAndStatus(
                        studentId,
                        callerId,
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                );
        if (!teachesStudent) {
            throw new ResponseStatusException(FORBIDDEN, "You can only access students in your own classes.");
        }
    }
}
