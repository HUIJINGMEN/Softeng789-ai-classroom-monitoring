package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AttendanceRecordResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CourseAttendanceBenchmarkResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAttendanceBenchmarkResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAttendanceHistoryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AttendanceService {
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final StudentRepository studentRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final ClassroomSessionService classroomSessionService;
    private final TeacherScopeSupport teacherScopeSupport;

    public AttendanceService(
            AttendanceRecordRepository attendanceRecordRepository,
            StudentRepository studentRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            ClassroomSessionService classroomSessionService,
            TeacherScopeSupport teacherScopeSupport
    ) {
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.studentRepository = studentRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.classroomSessionService = classroomSessionService;
        this.teacherScopeSupport = teacherScopeSupport;
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> listAttendance(UUID sessionId) {
        ClassroomSession session = classroomSessionService.findEntity(sessionId);
        Map<UUID, AttendanceRecord> recordsByStudentId = attendanceRecordRepository.findBySession_Id(sessionId)
                .stream()
                .collect(Collectors.toMap(record -> record.getStudent().getId(), Function.identity()));

        return studentsForSession(session).stream()
                .map(student -> toResponse(recordsByStudentId.get(student.getId()), student, session))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<AttendanceRecordResponse>> listAttendance(Collection<UUID> sessionIds) {
        List<ClassroomSession> sessions = classroomSessionService.findEntities(sessionIds);
        List<UUID> requestedIds = sessions.stream().map(ClassroomSession::getId).toList();
        Map<UUID, Map<UUID, AttendanceRecord>> recordsBySession = attendanceRecordRepository
                .findBySession_IdIn(requestedIds)
                .stream()
                .collect(Collectors.groupingBy(
                        record -> record.getSession().getId(),
                        Collectors.toMap(record -> record.getStudent().getId(), Function.identity())
                ));

        List<UUID> offeringIds = sessions.stream()
                .map(ClassroomSession::getCourseOffering)
                .filter(Objects::nonNull)
                .map(CourseOffering::getId)
                .distinct()
                .toList();
        Map<UUID, List<Student>> studentsByOffering = offeringIds.isEmpty()
                ? Map.of()
                : courseEnrollmentRepository
                        .findByCourseOffering_IdInAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                                offeringIds,
                                CourseEnrollment.EnrollmentStatus.ACTIVE
                        )
                        .stream()
                        .collect(Collectors.groupingBy(
                                enrollment -> enrollment.getCourseOffering().getId(),
                                LinkedHashMap::new,
                                Collectors.mapping(CourseEnrollment::getStudent, Collectors.toList())
                        ));

        Map<UUID, List<AttendanceRecordResponse>> result = new LinkedHashMap<>();
        for (ClassroomSession session : sessions) {
            CourseOffering offering = session.getCourseOffering();
            List<Student> roster = offering == null
                    ? List.of()
                    : studentsByOffering.getOrDefault(offering.getId(), List.of());
            Map<UUID, AttendanceRecord> records = recordsBySession.getOrDefault(session.getId(), Map.of());
            result.put(session.getId(), roster.stream()
                    .map(student -> toResponse(records.get(student.getId()), student, session))
                    .toList());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<StudentAttendanceHistoryResponse> listAttendanceHistory(UUID studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        }
        return attendanceRecordRepository
                .findByStudent_IdOrderBySession_DateDescSession_StartTimeDesc(studentId)
                .stream()
                .map(this::toHistoryResponse)
                .toList();
    }

    /** Staff read model: admins see the full history, while a teacher sees only records from
     * classes they teach. A shared student never exposes attendance from another teacher's class. */
    @Transactional(readOnly = true)
    public List<StudentAttendanceHistoryResponse> listAttendanceHistoryForStaff(
            UUID studentId,
            UUID callerId
    ) {
        if (!studentRepository.existsById(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        }
        Teacher caller = teacherScopeSupport.requireCaller(callerId);
        return attendanceRecordRepository
                .findByStudent_IdOrderBySession_DateDescSession_StartTimeDesc(studentId)
                .stream()
                .filter(record -> teacherScopeSupport.isAdmin(caller)
                        || isTaughtBy(record.getSession().getCourseOffering(), caller))
                .map(this::toHistoryResponse)
                .toList();
    }

    /**
     * Returns only cohort aggregates for the classes in which this student has an approved or
     * historical enrolment. No peer identity or individual attendance row leaves the service.
     * Rates use the same definition as the student portal: PRESENT + LATE divided by all stored
     * attendance marks, with every class weighted by its actual number of marks.
     */
    @Transactional(readOnly = true)
    public StudentAttendanceBenchmarkResponse getAttendanceBenchmark(UUID studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        }

        Map<String, BenchmarkAccumulator> byCourse = new HashMap<>();
        BenchmarkAccumulator overall = new BenchmarkAccumulator();

        courseEnrollmentRepository.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(studentId)
                .stream()
                .filter(enrollment -> enrollment.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING)
                .forEach(enrollment -> {
                    CourseOffering offering = enrollment.getCourseOffering();
                    String course = offering.getCourse().getCode();
                    BenchmarkAccumulator courseAccumulator = byCourse.computeIfAbsent(
                            course,
                            ignored -> new BenchmarkAccumulator()
                    );

                    for (AttendanceRecord record : attendanceRecordRepository
                            .findBySession_CourseOffering_Id(offering.getId())) {
                        courseAccumulator.add(record);
                        overall.add(record);
                    }
                });

        List<CourseAttendanceBenchmarkResponse> courseBenchmarks = byCourse.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getValue().toCourseResponse(entry.getKey()))
                .toList();

        return new StudentAttendanceBenchmarkResponse(
                overall.averageRate(),
                overall.participatingMarks,
                overall.totalMarks,
                overall.studentIds.size(),
                courseBenchmarks
        );
    }

    @Transactional
    public AttendanceRecordResponse updateAttendance(
            UUID sessionId,
            UUID studentId,
            UpdateAttendanceRequest request
    ) {
        ClassroomSession session = classroomSessionService.findEntity(sessionId);
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        if (!isStudentEnrolledInSessionCourse(student, session)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Student is not enrolled in this classroom session course.");
        }

        AttendanceRecord record = attendanceRecordRepository
                .findBySession_IdAndStudent_Id(sessionId, studentId)
                .orElseGet(AttendanceRecord::new);

        record.setSession(session);
        record.setStudent(student);
        record.setStatus(request.status());
        record.setSource(AttendanceSource.MANUAL);
        applyManualTimes(record, request.status());

        return toResponse(attendanceRecordRepository.save(record), student, session);
    }

    private void applyManualTimes(AttendanceRecord record, AttendanceStatus status) {
        if (status == AttendanceStatus.PRESENT || status == AttendanceStatus.LATE) {
            if (record.getCheckInTime() == null) {
                record.setCheckInTime(Instant.now());
            }
            return;
        }
        record.setCheckInTime(null);
        record.setCheckOutTime(null);
    }

    // The session's course_name/course text field is purely descriptive now — the actual roster
    // comes only from enrolments against the session's class (course offering). A student whose
    // free-text "course" happens to match by coincidence is not enrolled in this class.
    private List<Student> studentsForSession(ClassroomSession session) {
        CourseOffering offering = session.getCourseOffering();
        if (offering == null) {
            return List.of();
        }
        return courseEnrollmentRepository
                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        offering.getId(),
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                )
                .stream()
                .map(CourseEnrollment::getStudent)
                .toList();
    }

    private boolean isStudentEnrolledInSessionCourse(Student student, ClassroomSession session) {
        CourseOffering offering = session.getCourseOffering();
        return offering != null && courseEnrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                student.getId(), offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE);
    }

    private AttendanceRecordResponse toResponse(
            AttendanceRecord record,
            Student student,
            ClassroomSession session
    ) {
        return new AttendanceRecordResponse(
                record == null ? null : record.getId(),
                student.getId(),
                student.getStudentNumber(),
                student.getFullName(),
                session.getId(),
                record == null ? AttendanceStatus.UNKNOWN : record.getStatus(),
                record == null ? null : record.getCheckInTime(),
                record == null ? null : record.getCheckOutTime(),
                record == null ? null : record.getSource()
        );
    }

    private StudentAttendanceHistoryResponse toHistoryResponse(AttendanceRecord record) {
        ClassroomSession session = record.getSession();
        Room room = session.getRoomEntity();
        return new StudentAttendanceHistoryResponse(
                session.getId(),
                session.getCourse(),
                session.getRoom(),
                room == null ? null : room.getCampus().getId(),
                room == null ? null : room.getCampus().getName(),
                session.getDate(),
                session.getStartTime(),
                session.getEndTime(),
                record.getStatus(),
                record.getCheckInTime(),
                record.getCheckOutTime(),
                record.getSource()
        );
    }

    private boolean isTaughtBy(CourseOffering offering, Teacher caller) {
        return offering != null && offering.isTaughtBy(caller);
    }

    private static final class BenchmarkAccumulator {
        private long participatingMarks;
        private long totalMarks;
        private final Set<UUID> studentIds = new HashSet<>();

        private void add(AttendanceRecord record) {
            totalMarks += 1;
            if (record.getStatus() == AttendanceStatus.PRESENT || record.getStatus() == AttendanceStatus.LATE) {
                participatingMarks += 1;
            }
            studentIds.add(record.getStudent().getId());
        }

        private Integer averageRate() {
            return totalMarks == 0 ? null : (int) Math.round((participatingMarks * 100.0) / totalMarks);
        }

        private CourseAttendanceBenchmarkResponse toCourseResponse(String course) {
            return new CourseAttendanceBenchmarkResponse(
                    course,
                    averageRate(),
                    participatingMarks,
                    totalMarks,
                    studentIds.size()
            );
        }
    }
}
