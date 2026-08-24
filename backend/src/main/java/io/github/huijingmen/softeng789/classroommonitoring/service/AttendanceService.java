package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AttendanceRecordResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAttendanceHistoryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    public AttendanceService(
            AttendanceRecordRepository attendanceRecordRepository,
            StudentRepository studentRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            ClassroomSessionService classroomSessionService
    ) {
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.studentRepository = studentRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.classroomSessionService = classroomSessionService;
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
    public List<StudentAttendanceHistoryResponse> listAttendanceHistory(UUID studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        }
        return attendanceRecordRepository
                .findByStudent_IdOrderBySession_DateDescSession_StartTimeDesc(studentId)
                .stream()
                .map(record -> {
                    ClassroomSession session = record.getSession();
                    return new StudentAttendanceHistoryResponse(
                            session.getId(),
                            session.getCourse(),
                            session.getRoom(),
                            session.getDate(),
                            session.getStartTime(),
                            session.getEndTime(),
                            record.getStatus(),
                            record.getCheckInTime(),
                            record.getCheckOutTime(),
                            record.getSource()
                    );
                })
                .toList();
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

    private List<Student> studentsForSession(ClassroomSession session) {
        Map<UUID, Student> roster = new LinkedHashMap<>();
        courseEnrollmentRepository
                .findByCourse_CodeIgnoreCaseAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        session.getCourse(),
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                )
                .stream()
                .map(CourseEnrollment::getStudent)
                .forEach(student -> roster.put(student.getId(), student));
        studentRepository.findByCourseIgnoreCaseOrderByLastNameAscFirstNameAsc(session.getCourse())
                .forEach(student -> roster.putIfAbsent(student.getId(), student));
        return roster.values().stream().toList();
    }

    private boolean isStudentEnrolledInSessionCourse(Student student, ClassroomSession session) {
        return courseEnrollmentRepository.existsByStudent_IdAndCourse_CodeIgnoreCase(
                student.getId(),
                session.getCourse()
        ) || student.getCourse().equalsIgnoreCase(session.getCourse());
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
}
