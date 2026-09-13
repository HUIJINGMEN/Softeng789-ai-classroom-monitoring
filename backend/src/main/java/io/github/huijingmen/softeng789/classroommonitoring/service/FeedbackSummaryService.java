package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryDeliveryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateReportInsightRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReportInsightResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FeedbackSummary;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ProgressReport;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FeedbackSummaryRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ProgressReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FeedbackSummaryService {
    private static final String SUPERSEDED = "SUPERSEDED";
    private static final ZoneId REPORT_ZONE = ZoneId.of("Pacific/Auckland");

    private final FeedbackSummaryRepository summaryRepository;
    private final ProgressReportRepository progressReportRepository;
    private final ClassFeedbackRepository classFeedbackRepository;
    private final StudentRepository studentRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final FeedbackSummaryGateway summaryGateway;
    private final ReportEmailGateway emailGateway;
    private final TeacherScopeSupport access;

    public FeedbackSummaryService(
            FeedbackSummaryRepository summaryRepository,
            ProgressReportRepository progressReportRepository,
            ClassFeedbackRepository classFeedbackRepository,
            StudentRepository studentRepository,
            CourseOfferingRepository courseOfferingRepository,
            FeedbackSummaryGateway summaryGateway,
            ReportEmailGateway emailGateway,
            TeacherScopeSupport access
    ) {
        this.summaryRepository = summaryRepository;
        this.progressReportRepository = progressReportRepository;
        this.classFeedbackRepository = classFeedbackRepository;
        this.studentRepository = studentRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.summaryGateway = summaryGateway;
        this.emailGateway = emailGateway;
        this.access = access;
    }

    @Transactional
    public FeedbackSummaryResponse generate(GenerateFeedbackSummaryRequest request, UUID callerId) {
        if (request.dateTo().isBefore(request.dateFrom())) {
            throw new ResponseStatusException(BAD_REQUEST, "The end date must not be before the start date.");
        }
        Teacher caller = access.requireCaller(callerId);
        Student student = studentRepository.findById(request.studentId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        CourseOffering offering = courseOfferingRepository.findById(request.courseOfferingId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        access.assertCanAccessOffering(offering, caller);

        List<ProgressReport> source = progressReportRepository
                .findByStudent_IdAndCourseOffering_IdOrderByCreatedAtAsc(student.getId(), offering.getId())
                .stream()
                .filter(report -> inRange(report.getCreatedAt(), request.dateFrom(), request.dateTo()))
                .toList();
        if (source.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "No feedback exists for this student, class and date range.");
        }

        String fingerprint = fingerprint(source);
        var existing = summaryRepository
                .findFirstByStudent_IdAndCourseOffering_IdAndDateFromAndDateToAndSourceFingerprintAndStatusNotOrderByCreatedAtDesc(
                        student.getId(), offering.getId(), request.dateFrom(), request.dateTo(), fingerprint, SUPERSEDED);
        if (existing.isPresent()) return toResponse(existing.get());

        summaryRepository
                .findByStudent_IdAndCourseOffering_IdAndDateFromAndDateToAndStatusNot(
                        student.getId(), offering.getId(), request.dateFrom(), request.dateTo(), SUPERSEDED)
                .stream()
                .filter(summary -> "DRAFT".equals(summary.getStatus()))
                .forEach(summary -> summary.setStatus(SUPERSEDED));

        String classLabel = offering.getCourse().getCode() + " · " + offering.getAcademicTerm();
        FeedbackSummaryGateway.GeneratedSummary generated = summaryGateway.summarize(
                student.getFullName(), classLabel, request.dateFrom(), request.dateTo(),
                source.stream().map(ProgressReport::getComment).toList());

        FeedbackSummary summary = new FeedbackSummary();
        summary.setStudent(student);
        summary.setCourseOffering(offering);
        summary.setCreatedBy(caller);
        summary.setDateFrom(request.dateFrom());
        summary.setDateTo(request.dateTo());
        summary.setSummary(generated.summary());
        summary.setStrengths(generated.strengths());
        summary.setNextSteps(generated.nextSteps());
        summary.setSourceFeedbackCount(source.size());
        summary.setSourceFingerprint(fingerprint);
        summary.setProvider(generated.provider());
        return toResponse(summaryRepository.save(summary));
    }

    @Transactional(readOnly = true)
    public ReportInsightResponse generateInsight(GenerateReportInsightRequest request, UUID callerId) {
        if (request.dateTo().isBefore(request.dateFrom())) {
            throw new ResponseStatusException(BAD_REQUEST, "The end date must not be before the start date.");
        }

        Teacher caller = access.requireCaller(callerId);
        String scope = request.scope().trim().toUpperCase();
        UUID offeringId = null;
        String title;
        List<ProgressReport> visibleStudentFeedback;
        List<ClassFeedback> visibleClassFeedback;

        if ("OVERALL".equals(scope)) {
            visibleStudentFeedback = access.isAdmin(caller)
                    ? progressReportRepository.findAllByOrderByCreatedAtDesc()
                    : progressReportRepository.findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(callerId);
            visibleClassFeedback = access.isAdmin(caller)
                    ? classFeedbackRepository.findAllByOrderByCreatedAtDesc()
                    : classFeedbackRepository.findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(callerId);
            title = access.isAdmin(caller) ? "Institution feedback overview" : "My classes feedback overview";
        } else if ("CLASS".equals(scope)) {
            if (request.courseOfferingId() == null) {
                throw new ResponseStatusException(BAD_REQUEST, "A class is required for a class report.");
            }
            CourseOffering offering = courseOfferingRepository.findById(request.courseOfferingId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
            access.assertCanAccessOffering(offering, caller);
            visibleStudentFeedback = progressReportRepository.findByCourseOffering_IdOrderByCreatedAtDesc(offering.getId());
            visibleClassFeedback = classFeedbackRepository.findByCourseOffering_IdOrderByCreatedAtDesc(offering.getId());
            offeringId = offering.getId();
            title = offering.getCourse().getCode() + " · " + offering.getAcademicTerm();
        } else {
            throw new ResponseStatusException(BAD_REQUEST, "Report scope must be OVERALL or CLASS.");
        }

        List<String> studentComments = visibleStudentFeedback.stream()
                .filter(report -> inRange(report.getCreatedAt(), request.dateFrom(), request.dateTo()))
                .map(ProgressReport::getComment)
                .toList();
        List<String> classComments = visibleClassFeedback.stream()
                .filter(feedback -> inRange(feedback.getCreatedAt(), request.dateFrom(), request.dateTo()))
                .map(ClassFeedback::getComment)
                .toList();
        List<String> sourceComments = java.util.stream.Stream.concat(
                classComments.stream(), studentComments.stream()).toList();
        if (sourceComments.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "No teacher feedback exists in this report range.");
        }

        FeedbackSummaryGateway.GeneratedSummary generated = summaryGateway.summarize(
                "This report", title, request.dateFrom(), request.dateTo(),
                sourceComments);
        return new ReportInsightResponse(
                scope, offeringId, title, request.dateFrom(), request.dateTo(),
                generated.summary(), generated.strengths(), generated.nextSteps(),
                sourceComments.size(), generated.provider());
    }

    @Transactional(readOnly = true)
    public List<FeedbackSummaryResponse> listForCaller(UUID callerId, UUID studentId) {
        Teacher caller = access.requireCaller(callerId);
        List<FeedbackSummary> summaries = studentId == null
                ? summaryRepository.findByStatusNotOrderByCreatedAtDesc(SUPERSEDED)
                : summaryRepository.findByStudent_IdAndStatusNotOrderByCreatedAtDesc(studentId, SUPERSEDED);
        LinkedHashMap<String, FeedbackSummary> latest = new LinkedHashMap<>();
        summaries.stream()
                .filter(summary -> access.isAdmin(caller) || summary.getCourseOffering().isTaughtBy(caller))
                .forEach(summary -> latest.putIfAbsent(scopeKey(summary), summary));
        return latest.values().stream().map(this::toResponse).toList();
    }

    @Transactional
    public FeedbackSummaryResponse review(UUID id, ReviewFeedbackSummaryRequest request, UUID callerId) {
        FeedbackSummary summary = requireAccessible(id, callerId);
        if (SUPERSEDED.equals(summary.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST, "This summary has been replaced by a newer version.");
        }
        Teacher caller = access.requireCaller(callerId);
        summary.setSummary(request.summary().trim());
        summary.setStrengths(request.strengths().trim());
        summary.setNextSteps(request.nextSteps().trim());
        summary.setStatus("REVIEWED");
        summary.setReviewedBy(caller);
        summary.setReviewedAt(Instant.now());
        return toResponse(summaryRepository.save(summary));
    }

    @Transactional
    public FeedbackSummaryResponse publish(UUID id, UUID callerId) {
        FeedbackSummary summary = requireReviewed(id, callerId);
        summaryRepository
                .findByStudent_IdAndCourseOffering_IdAndDateFromAndDateToAndStatusNot(
                        summary.getStudent().getId(), summary.getCourseOffering().getId(),
                        summary.getDateFrom(), summary.getDateTo(), SUPERSEDED)
                .stream()
                .filter(other -> !other.getId().equals(summary.getId()) && other.getPublishedAt() != null)
                .forEach(other -> other.setStatus(SUPERSEDED));
        summary.setPublishedAt(Instant.now());
        return toResponse(summaryRepository.save(summary));
    }

    @Transactional
    public FeedbackSummaryDeliveryResponse email(UUID id, UUID callerId) {
        FeedbackSummary summary = requireReviewed(id, callerId);
        ReportEmailGateway.DeliveryResult result = emailGateway.send(summary);
        if ("SENT".equals(result.status())) {
            summary.setEmailedAt(Instant.now());
            summaryRepository.save(summary);
        }
        return new FeedbackSummaryDeliveryResponse("EMAIL", result.status(), result.message());
    }

    @Transactional(readOnly = true)
    public List<FeedbackSummaryResponse> listPublishedForStudent(UUID studentId) {
        return summaryRepository
                .findByStudent_IdAndPublishedAtIsNotNullAndStatusOrderByCreatedAtDesc(studentId, "REVIEWED")
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private FeedbackSummary requireReviewed(UUID id, UUID callerId) {
        FeedbackSummary summary = requireAccessible(id, callerId);
        if (!"REVIEWED".equals(summary.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST, "Review and confirm the AI summary first.");
        }
        return summary;
    }

    private FeedbackSummary requireAccessible(UUID id, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        FeedbackSummary summary = summaryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Feedback summary not found."));
        access.assertCanAccessOffering(summary.getCourseOffering(), caller);
        return summary;
    }

    private boolean inRange(Instant value, LocalDate from, LocalDate to) {
        LocalDate date = value.atZone(REPORT_ZONE).toLocalDate();
        return !date.isBefore(from) && !date.isAfter(to);
    }

    private String fingerprint(List<ProgressReport> reports) {
        StringBuilder value = new StringBuilder();
        reports.forEach(report -> value.append(report.getId()).append('|')
                .append(report.getCreatedAt()).append('|').append(report.getComment()).append('\n'));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }

    private String scopeKey(FeedbackSummary summary) {
        return summary.getStudent().getId() + ":" + summary.getCourseOffering().getId() + ":"
                + summary.getDateFrom() + ":" + summary.getDateTo();
    }

    private FeedbackSummaryResponse toResponse(FeedbackSummary value) {
        CourseOffering offering = value.getCourseOffering();
        return new FeedbackSummaryResponse(
                value.getId(), value.getStudent().getId(), value.getStudent().getFullName(),
                value.getStudent().getUniversityEmail(), offering.getId(),
                offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                value.getDateFrom(), value.getDateTo(), value.getSummary(), value.getStrengths(),
                value.getNextSteps(), value.getSourceFeedbackCount(), value.getProvider(), value.getStatus(),
                value.getCreatedBy().getId(), value.getCreatedBy().getName(),
                value.getReviewedBy() == null ? null : value.getReviewedBy().getName(),
                value.getCreatedAt(), value.getReviewedAt(), value.getPublishedAt(), value.getEmailedAt());
    }
}
