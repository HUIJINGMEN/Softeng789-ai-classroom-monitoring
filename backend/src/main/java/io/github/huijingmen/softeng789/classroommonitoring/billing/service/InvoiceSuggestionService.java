package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.MembershipInterval;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PayPerLessonTrigger;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CourseChargeSuggestionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeableSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.StudentChargeSuggestionsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class InvoiceSuggestionService {
    private static final String CURRENCY = "NZD";
    private static final EnumSet<LearningEntitlementStatus> BILLED_STATUSES = EnumSet.of(
            LearningEntitlementStatus.PENDING_PAYMENT,
            LearningEntitlementStatus.ACTIVE,
            LearningEntitlementStatus.COMPLETED,
            LearningEntitlementStatus.EXPIRED
    );

    private final StudentRepository studentRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final StudentLearningEntitlementRepository entitlementRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AttendanceRecordRepository attendanceRepository;

    public InvoiceSuggestionService(
            StudentRepository studentRepository,
            CourseEnrollmentRepository enrollmentRepository,
            StudentLearningEntitlementRepository entitlementRepository,
            ClassroomSessionRepository sessionRepository,
            AttendanceRecordRepository attendanceRepository
    ) {
        this.studentRepository = studentRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.entitlementRepository = entitlementRepository;
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
    }

    @Transactional(readOnly = true)
    public ChargeSuggestionPreviewResponse preview(ChargeSuggestionPreviewRequest request) {
        List<UUID> studentIds = request.studentIds().stream().distinct().toList();
        if (studentIds.size() != request.studentIds().size()) {
            throw new ResponseStatusException(BAD_REQUEST, "Each student may appear only once.");
        }
        Map<UUID, Student> students = studentRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Student::getId, Function.identity()));
        if (students.size() != studentIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more students could not be found.");
        }
        LocalDate billingDate = request.billingDate() == null ? BillingDates.today() : request.billingDate();
        List<CourseEnrollment> enrollments = enrollmentRepository
                .findByStudent_IdInAndStatusOrderByCourseOffering_Course_CodeAsc(studentIds, EnrollmentStatus.ACTIVE);
        Set<UUID> offeringIds = enrollments.stream()
                .map(enrollment -> enrollment.getCourseOffering().getId())
                .collect(Collectors.toSet());
        List<ClassroomSession> candidateSessions = offeringIds.isEmpty()
                ? List.of()
                : sessionRepository.findByCourseOffering_IdInOrderByDateAscStartTimeAsc(offeringIds);
        Map<UUID, List<ClassroomSession>> sessionsByOffering = candidateSessions.stream()
                .filter(session -> session.getStatus() != SessionStatus.CANCELLED)
                .collect(Collectors.groupingBy(
                        session -> session.getCourseOffering().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        List<StudentLearningEntitlement> entitlements = entitlementRepository.findByStudent_IdIn(studentIds);
        Map<UUID, List<StudentLearningEntitlement>> entitlementsByStudent = entitlements.stream()
                .filter(item -> BILLED_STATUSES.contains(item.getStatus()))
                .collect(Collectors.groupingBy(item -> item.getStudent().getId()));
        List<UUID> sessionIds = sessionsByOffering.values().stream().flatMap(List::stream)
                .map(ClassroomSession::getId).toList();
        Map<UUID, List<AttendanceRecord>> attendanceByStudent = sessionIds.isEmpty()
                ? Map.of()
                : attendanceRepository.findByStudent_IdInAndSession_IdIn(studentIds, sessionIds).stream()
                    .collect(Collectors.groupingBy(record -> record.getStudent().getId()));
        Map<UUID, List<CourseEnrollment>> enrollmentsByStudent = enrollments.stream()
                .collect(Collectors.groupingBy(enrollment -> enrollment.getStudent().getId()));

        List<StudentChargeSuggestionsResponse> response = studentIds.stream().map(studentId -> {
            Student student = students.get(studentId);
            List<CourseChargeSuggestionResponse> courses = enrollmentsByStudent
                    .getOrDefault(studentId, List.of()).stream()
                    .map(enrollment -> suggestion(
                            enrollment.getCourseOffering(),
                            entitlementsByStudent.getOrDefault(studentId, List.of()),
                            sessionsByOffering.getOrDefault(enrollment.getCourseOffering().getId(), List.of()),
                            attendanceByStudent.getOrDefault(studentId, List.of()),
                            billingDate,
                            request.preferredCourseOfferingId()
                    ))
                    .sorted(Comparator
                            .comparing(CourseChargeSuggestionResponse::preferredCourse).reversed()
                            .thenComparing(CourseChargeSuggestionResponse::courseCode))
                    .toList();
            return new StudentChargeSuggestionsResponse(
                    studentId, student.getFullName(), student.getStudentNumber(), courses
            );
        }).toList();
        return new ChargeSuggestionPreviewResponse(billingDate, response);
    }

    private CourseChargeSuggestionResponse suggestion(
            CourseOffering offering,
            List<StudentLearningEntitlement> studentEntitlements,
            List<ClassroomSession> sessions,
            List<AttendanceRecord> attendance,
            LocalDate billingDate,
            UUID preferredCourseOfferingId
    ) {
        boolean preferred = offering.getId().equals(preferredCourseOfferingId);
        CoursePurchaseMode mode = offering.getPurchaseMode();
        LocalDate validFrom = null;
        LocalDate validTo = null;
        ClassroomSession selectedSession = null;
        List<ClassroomSession> chargeableSessions = List.of();
        ChargeSuggestionStatus status = ChargeSuggestionStatus.READY;
        String detail = "Not yet invoiced";
        StudentLearningEntitlement previous = null;

        if (mode == CoursePurchaseMode.COURSE_ENROLMENT) {
            previous = findCourseEntitlement(studentEntitlements, offering, mode);
        } else if (mode == CoursePurchaseMode.MEMBERSHIP) {
            LocalDate[] period = membershipPeriod(offering, sessions, billingDate);
            validFrom = period[0];
            validTo = period[1];
            if (validFrom == null || validTo == null) {
                status = ChargeSuggestionStatus.UNAVAILABLE;
                detail = "Membership dates cannot be derived from this class timetable";
            } else {
                previous = findMembershipEntitlement(studentEntitlements, offering, validFrom, validTo);
            }
        } else if (mode == CoursePurchaseMode.PAY_PER_LESSON) {
            chargeableSessions = chargeableSessions(offering, sessions, attendance, studentEntitlements, billingDate);
            selectedSession = chargeableSessions.isEmpty() ? null : chargeableSessions.getFirst();
            if (selectedSession == null) {
                status = ChargeSuggestionStatus.UNAVAILABLE;
                detail = offering.getPayPerLessonTrigger() == PayPerLessonTrigger.ATTENDANCE
                        ? "No attended lesson is waiting to be charged"
                        : "No upcoming unbilled lesson is available";
            } else {
                validFrom = selectedSession.getDate();
                validTo = selectedSession.getDate();
            }
        } else {
            LocalDate start = sessions.stream().map(ClassroomSession::getDate)
                    .filter(date -> !date.isBefore(billingDate)).findFirst().orElse(billingDate);
            validFrom = start;
            validTo = offering.getPackageValidityDays() == null
                    ? null : start.plusDays(offering.getPackageValidityDays() - 1L);
            boolean hasLivePackage = studentEntitlements.stream().anyMatch(item ->
                    item.getCourseOffering().getId().equals(offering.getId())
                            && item.getPurchaseMode() == CoursePurchaseMode.LESSON_PACKAGE
                            && (item.getStatus() == LearningEntitlementStatus.PENDING_PAYMENT
                                || item.getStatus() == LearningEntitlementStatus.ACTIVE));
            if (hasLivePackage) {
                status = ChargeSuggestionStatus.OPTIONAL_RENEWAL;
                detail = "Student already has a current package; include only for a new purchase";
            } else if (offering.getDefaultSessionCount() == null || validTo == null) {
                status = ChargeSuggestionStatus.UNAVAILABLE;
                detail = "Complete the lesson count and validity in Billing setup";
            }
        }

        if (previous != null) {
            status = ChargeSuggestionStatus.ALREADY_BILLED;
            detail = previous.getInvoice() == null
                    ? "This course has already been charged"
                    : "Already included on invoice " + previous.getInvoice().getInvoiceNumber();
        } else if (status == ChargeSuggestionStatus.READY && offering.getDefaultPrice() == null) {
            status = ChargeSuggestionStatus.NEEDS_PRICE;
            detail = "Add a price before creating the invoice";
        }
        boolean eligibleByDefault = status == ChargeSuggestionStatus.READY || status == ChargeSuggestionStatus.NEEDS_PRICE;
        boolean selected = eligibleByDefault && (preferredCourseOfferingId == null || preferred);
        String description = offering.getCourse().getCode() + " · " + offering.getAcademicTerm()
                + " " + purchaseLabel(mode);
        return new CourseChargeSuggestionResponse(
                offering.getId(), offering.getCourse().getCode(), offering.getAcademicTerm(), mode,
                description, offering.getDefaultPrice(), CURRENCY, status, detail, selected, preferred,
                validFrom, validTo, offering.getDefaultSessionCount(), offering.getAbsencePolicy(),
                chargeableSessions.stream().limit(50).map(session -> new ChargeableSessionResponse(
                        session.getId(), session.getDate(), session.getStartTime(), session.getEndTime()
                )).toList(),
                selectedSession == null ? null : selectedSession.getId(),
                selectedSession == null ? null : selectedSession.getDate(),
                selectedSession == null ? null : selectedSession.getStartTime(),
                selectedSession == null ? null : selectedSession.getEndTime(),
                previous == null || previous.getInvoice() == null
                        ? null : previous.getInvoice().getInvoiceNumber()
        );
    }

    private StudentLearningEntitlement findCourseEntitlement(
            List<StudentLearningEntitlement> entitlements,
            CourseOffering offering,
            CoursePurchaseMode mode
    ) {
        return entitlements.stream().filter(item ->
                item.getCourseOffering().getId().equals(offering.getId()) && item.getPurchaseMode() == mode
        ).findFirst().orElse(null);
    }

    private StudentLearningEntitlement findMembershipEntitlement(
            List<StudentLearningEntitlement> entitlements,
            CourseOffering offering,
            LocalDate from,
            LocalDate to
    ) {
        return entitlements.stream().filter(item ->
                item.getCourseOffering().getId().equals(offering.getId())
                        && item.getPurchaseMode() == CoursePurchaseMode.MEMBERSHIP
                        && item.getValidFrom() != null && item.getValidTo() != null
                        && !item.getValidFrom().isAfter(to) && !item.getValidTo().isBefore(from)
        ).findFirst().orElse(null);
    }

    private List<ClassroomSession> chargeableSessions(
            CourseOffering offering,
            List<ClassroomSession> sessions,
            List<AttendanceRecord> attendance,
            List<StudentLearningEntitlement> entitlements,
            LocalDate billingDate
    ) {
        Set<UUID> billedSessionIds = entitlements.stream()
                .filter(item -> item.getCourseOffering().getId().equals(offering.getId()))
                .map(StudentLearningEntitlement::getClassroomSession)
                .filter(java.util.Objects::nonNull)
                .map(ClassroomSession::getId)
                .collect(Collectors.toSet());
        if (offering.getPayPerLessonTrigger() == PayPerLessonTrigger.ATTENDANCE) {
            return attendance.stream()
                    .filter(record -> record.getSession().getCourseOffering().getId().equals(offering.getId()))
                    .filter(record -> record.getStatus() == AttendanceStatus.PRESENT || record.getStatus() == AttendanceStatus.LATE)
                    .map(AttendanceRecord::getSession)
                    .filter(session -> !billedSessionIds.contains(session.getId()))
                    .sorted(Comparator.comparing(ClassroomSession::getDate).thenComparing(ClassroomSession::getStartTime))
                    .toList();
        }
        return sessions.stream()
                .filter(session -> !session.getDate().isBefore(billingDate))
                .filter(session -> !billedSessionIds.contains(session.getId()))
                .toList();
    }

    private LocalDate[] membershipPeriod(
            CourseOffering offering,
            List<ClassroomSession> sessions,
            LocalDate billingDate
    ) {
        MembershipInterval interval = offering.getMembershipInterval();
        if (interval == null) return new LocalDate[]{null, null};
        return switch (interval) {
            case WEEKLY -> new LocalDate[]{
                    billingDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)),
                    billingDate.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))
            };
            case MONTHLY -> new LocalDate[]{billingDate.withDayOfMonth(1), billingDate.withDayOfMonth(billingDate.lengthOfMonth())};
            case ANNUAL -> new LocalDate[]{billingDate.withDayOfYear(1), billingDate.withDayOfYear(billingDate.lengthOfYear())};
            case TERM -> sessions.isEmpty()
                    ? new LocalDate[]{null, null}
                    : new LocalDate[]{sessions.getFirst().getDate(), sessions.getLast().getDate()};
        };
    }

    private String purchaseLabel(CoursePurchaseMode mode) {
        return switch (mode) {
            case COURSE_ENROLMENT -> "full course enrolment";
            case LESSON_PACKAGE -> "lesson package";
            case MEMBERSHIP -> "membership";
            case PAY_PER_LESSON -> "lesson fee";
        };
    }
}
