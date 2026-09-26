package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentDirectoryItemResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Builds the filterable roster projection without mixing directory concerns into student CRUD. */
@Service
public class StudentDirectoryService {
    private final StudentRepository studentRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final StudentService studentService;
    private final TeacherScopeSupport access;

    public StudentDirectoryService(
            StudentRepository studentRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            StudentService studentService,
            TeacherScopeSupport access
    ) {
        this.studentRepository = studentRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.studentService = studentService;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentDirectoryItemResponse> list(
            UUID callerId,
            int page,
            int size,
            String query,
            String course,
            String level,
            String sort,
            String direction
    ) {
        var pageRequest = PageRequestSupport.create(page, size);
        Teacher caller = access.requireCaller(callerId);
        boolean admin = access.isAdmin(caller);
        List<Student> visible = admin
                ? studentRepository.findByApprovalStatusOrderByLastNameAscFirstNameAsc("APPROVED")
                : studentRepository.findApprovedStudentsVisibleToTeacher(
                        callerId,
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                );
        StudentLevel parsedLevel = parseLevel(level);
        String normalizedQuery = normalize(query);
        String normalizedCourse = normalize(course);
        List<StudentResponse> filtered = studentService.toResponses(visible).stream()
                .filter(student -> matches(student, normalizedQuery, normalizedCourse, parsedLevel))
                .toList();
        Map<UUID, Integer> rates = attendanceRates(
                filtered.stream().map(StudentResponse::id).toList(),
                admin ? null : callerId
        );
        List<StudentResponse> ordered = filtered.stream()
                .sorted(comparator(sort, rates, parseDescending(direction)))
                .toList();

        return PageResponse.fromList(
                ordered,
                pageRequest,
                student -> new StudentDirectoryItemResponse(student, rates.get(student.id()))
        );
    }

    private boolean matches(
            StudentResponse student,
            String query,
            String course,
            StudentLevel level
    ) {
        String searchable = String.join(" ",
                student.firstName(),
                student.lastName(),
                student.studentNumber(),
                student.universityEmail()
        ).toLowerCase(Locale.ROOT);
        return (query.isEmpty() || searchable.contains(query))
                && (course.isEmpty() || student.courses().stream()
                        .map(StudentDirectoryService::normalize)
                        .anyMatch(course::equals))
                && (level == null || student.level() == level);
    }

    private Map<UUID, Integer> attendanceRates(List<UUID> studentIds, UUID teacherId) {
        if (studentIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Integer> rates = new HashMap<>();
        List<AttendanceRecordRepository.StudentAttendanceRate> summaries = teacherId == null
                ? attendanceRecordRepository.summarizeRates(
                        studentIds,
                        List.of(AttendanceStatus.PRESENT, AttendanceStatus.LATE),
                        AttendanceStatus.UNKNOWN
                )
                : attendanceRecordRepository.summarizeRatesForTeacher(
                        studentIds,
                        teacherId,
                        List.of(AttendanceStatus.PRESENT, AttendanceStatus.LATE),
                        AttendanceStatus.UNKNOWN
                );
        summaries.forEach(summary -> {
            long recorded = summary.getRecordedCount() == null ? 0 : summary.getRecordedCount();
            if (recorded > 0) {
                long participating = summary.getParticipatingCount() == null
                        ? 0
                        : summary.getParticipatingCount();
                rates.put(summary.getStudentId(), (int) Math.round(participating * 100.0 / recorded));
            }
        });
        return rates;
    }

    private Comparator<StudentResponse> comparator(
            String sort,
            Map<UUID, Integer> rates,
            boolean descending
    ) {
        Comparator<StudentResponse> stableName = Comparator
                .comparing(StudentResponse::lastName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(StudentResponse::firstName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(StudentResponse::studentNumber, String.CASE_INSENSITIVE_ORDER);
        Comparator<Integer> rateOrder = descending
                ? Comparator.reverseOrder()
                : Comparator.naturalOrder();
        return switch (normalize(sort)) {
            case "", "attendance", "rate" -> Comparator.comparing(
                    (StudentResponse student) -> rates.get(student.id()),
                    Comparator.nullsLast(rateOrder)
            ).thenComparing(stableName);
            case "name" -> descending ? stableName.reversed() : stableName;
            case "level" -> Comparator.comparing(
                    StudentResponse::level,
                    descending ? Comparator.reverseOrder() : Comparator.naturalOrder()
            ).thenComparing(stableName);
            default -> throw new ResponseStatusException(BAD_REQUEST, "Unsupported student sort field.");
        };
    }

    private boolean parseDescending(String value) {
        if (value == null || value.isBlank() || "asc".equalsIgnoreCase(value)) {
            return false;
        }
        if ("desc".equalsIgnoreCase(value)) {
            return true;
        }
        throw new ResponseStatusException(BAD_REQUEST, "Sort direction must be asc or desc.");
    }

    private StudentLevel parseLevel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return StudentLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported student level.");
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
