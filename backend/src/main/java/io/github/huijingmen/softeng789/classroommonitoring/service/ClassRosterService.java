package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassStudentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RemoveClassStudentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Student roster management for a class (add/remove/transfer) — split out of AdminClassService,
 * which now only handles class CRUD and teacher assignment. Depends on AdminClassService for
 * class lookup ({@code findEntity}) and response mapping ({@code toResponse}) rather than
 * duplicating either.
 */
@Service
public class ClassRosterService {
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final StudentService studentService;
    private final AdminClassService adminClassService;
    private final TeacherScopeSupport access;

    public ClassRosterService(
            CourseEnrollmentRepository courseEnrollmentRepository,
            StudentService studentService,
            AdminClassService adminClassService,
            TeacherScopeSupport access
    ) {
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.studentService = studentService;
        this.adminClassService = adminClassService;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> listStudents(UUID classId) {
        CourseOffering offering = adminClassService.findEntity(classId);
        return listActiveStudents(offering);
    }

    /** Read-only roster access for the shared staff endpoint. Admins may read every offering;
     *  teachers may read only offerings assigned to them. Roster mutations remain exclusively
     *  behind AdminClassController. */
    @Transactional(readOnly = true)
    public List<StudentResponse> listStudents(UUID classId, UUID callerId) {
        CourseOffering offering = adminClassService.findEntity(classId);
        access.assertCanAccessOffering(offering, access.requireCaller(callerId));
        return listActiveStudents(offering);
    }

    private List<StudentResponse> listActiveStudents(CourseOffering offering) {
        return courseEnrollmentRepository
                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        offering.getId(),
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                )
                .stream()
                .map(CourseEnrollment::getStudent)
                .map(studentService::toResponse)
                .toList();
    }

    @Transactional
    public void addStudent(UUID classId, AddClassStudentRequest request) {
        CourseOffering offering = adminClassService.findEntity(classId);
        enrol(offering, studentService.findEntity(request.studentId()));
    }

    @Transactional
    public ClassResponse addStudents(UUID classId, AddClassStudentsRequest request) {
        CourseOffering offering = adminClassService.findEntity(classId);
        for (UUID studentId : request.studentIds()) {
            enrol(offering, studentService.findEntity(studentId));
        }
        return adminClassService.toResponse(offering);
    }

    // A withdrawal is a status change, not a delete — attendance/session history tied to the old
    // enrolment must survive it, and re-adding the same student later should resume the same row
    // (see enrol()) rather than fight the (student, class) unique constraint with a duplicate.
    @Transactional
    public void removeStudent(UUID classId, UUID studentId) {
        adminClassService.findEntity(classId);
        withdraw(classId, studentId);
    }

    @Transactional
    public void removeStudents(UUID classId, RemoveClassStudentsRequest request) {
        adminClassService.findEntity(classId);
        for (UUID studentId : request.studentIds()) {
            withdraw(classId, studentId);
        }
    }

    @Transactional
    public void transferStudent(UUID studentId, UUID fromClassId, UUID toClassId) {
        if (fromClassId.equals(toClassId)) {
            throw new ResponseStatusException(BAD_REQUEST, "Source and destination classes must be different.");
        }
        CourseOffering toOffering = adminClassService.findEntity(toClassId);
        adminClassService.findEntity(fromClassId);
        withdraw(fromClassId, studentId);
        enrol(toOffering, studentService.findEntity(studentId));
    }

    // Every path that puts a student in a class (addStudent, addStudents, transferStudent's
    // re-enrol step) funnels through here, so this one check covers all of them — a withdrawn
    // student can't be handed a new class assignment until an Admin reactivates their account.
    private void enrol(CourseOffering offering, Student student) {
        if (!"ACTIVE".equals(student.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST,
                    student.getFullName() + " has been withdrawn and can't be enrolled in a class.");
        }
        Optional<CourseEnrollment> existing = courseEnrollmentRepository
                .findByStudent_IdAndCourseOffering_Id(student.getId(), offering.getId());
        if (existing.isPresent()) {
            CourseEnrollment enrollment = existing.get();
            if (enrollment.getStatus() == CourseEnrollment.EnrollmentStatus.ACTIVE) {
                return;
            }
            enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
            enrollment.setEnrolledAt(Instant.now());
            enrollment.setWithdrawnAt(null);
            courseEnrollmentRepository.save(enrollment);
            return;
        }
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        courseEnrollmentRepository.save(enrollment);
    }

    private void withdraw(UUID classId, UUID studentId) {
        CourseEnrollment enrollment = courseEnrollmentRepository
                .findByStudent_IdAndCourseOffering_IdAndStatus(
                        studentId, classId, CourseEnrollment.EnrollmentStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(
                        NOT_FOUND, "Student is not actively enrolled in this class."));
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN);
        enrollment.setWithdrawnAt(Instant.now());
        courseEnrollmentRepository.save(enrollment);
    }
}
