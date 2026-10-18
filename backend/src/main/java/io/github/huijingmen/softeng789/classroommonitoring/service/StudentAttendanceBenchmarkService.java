package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CourseAttendanceBenchmarkResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAttendanceBenchmarkResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Self-portal cohort aggregates only. No peer identities leave this service. */
@Service
public class StudentAttendanceBenchmarkService {
    private final StudentRepository students;
    private final CourseEnrollmentRepository enrolments;
    private final AttendanceRecordRepository attendance;

    public StudentAttendanceBenchmarkService(StudentRepository students, CourseEnrollmentRepository enrolments,
            AttendanceRecordRepository attendance) {
        this.students = students;
        this.enrolments = enrolments;
        this.attendance = attendance;
    }

    @Transactional(readOnly = true)
    public StudentAttendanceBenchmarkResponse get(UUID studentId) {
        if (!students.existsById(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        }
        var offerings = enrolments.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(studentId).stream()
                .filter(row -> row.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING)
                .map(CourseEnrollment::getCourseOffering).distinct().toList();
        Map<String, Counts> byCourse = new TreeMap<>();
        offerings.forEach(offering -> byCourse.putIfAbsent(offering.getCourse().getCode(), new Counts()));
        Counts overall = new Counts();
        Instant asOf = Instant.now();
        // Load once for all exact offerings; current enrolment changes do not delete stored marks.
        if (!offerings.isEmpty()) {
            attendance.findBySession_CourseOffering_IdIn(offerings.stream().map(CourseOffering::getId).toList())
                    .stream().filter(row -> AttendanceMetricPolicy.completedBy(row.getSession(), asOf))
                    .filter(row -> AttendanceMetricPolicy.recorded(row.getStatus()))
                    .forEach(row -> {
                        byCourse.get(row.getSession().getCourseOffering().getCourse().getCode()).add(row);
                        overall.add(row);
                    });
        }
        var courses = byCourse.entrySet().stream().map(entry -> new CourseAttendanceBenchmarkResponse(
                entry.getKey(), entry.getValue().rate(), entry.getValue().attended,
                entry.getValue().recorded, entry.getValue().students.size())).toList();
        return new StudentAttendanceBenchmarkResponse(overall.rate(), overall.attended,
                overall.recorded, overall.students.size(), courses);
    }

    private static final class Counts {
        private long attended;
        private long recorded;
        private final Set<UUID> students = new HashSet<>();

        private void add(AttendanceRecord row) {
            recorded++;
            if (row.getStatus() == AttendanceStatus.PRESENT || row.getStatus() == AttendanceStatus.LATE) attended++;
            students.add(row.getStudent().getId());
        }

        private Integer rate() { return AttendanceMetricPolicy.rate(attended, recorded); }
    }
}
