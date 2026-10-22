package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import io.github.huijingmen.softeng789.classroommonitoring.repository.FeedbackSummaryRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Owns authorization, locked revision claims and completion; never performs network delivery. */
@Service
public class FeedbackEmailDeliveryStore {
    static final ReportEmailGateway.DeliveryResult UNKNOWN = new ReportEmailGateway.DeliveryResult("UNKNOWN",
            "Delivery could not be confirmed and will not be retried. Check with the recipient or mail administrator.");

    private final FeedbackSummaryRepository summaries;
    private final FeedbackEmailRepository deliveries;
    private final TeacherScopeSupport access;
    private final JsonMapper json;

    public FeedbackEmailDeliveryStore(FeedbackSummaryRepository summaries, FeedbackEmailRepository deliveries,
            TeacherScopeSupport access, JsonMapper json) {
        this.summaries = summaries;
        this.deliveries = deliveries;
        this.access = access;
        this.json = json;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(UUID id, UUID caller) {
        var summary = summaries.findForDelivery(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Feedback summary not found."));
        access.assertCanAccessOffering(summary.getCourseOffering(), access.requireCaller(caller));
        if (!"REVIEWED".equals(summary.getStatus()) || summary.getReviewedAt() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Review and confirm the AI summary first.");
        }
        var offering = summary.getCourseOffering();
        var student = summary.getStudent();
        if (student.getUniversityEmail() == null || student.getUniversityEmail().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "The student has no email address.");
        }
        var message = new ReportEmailGateway.EmailMessage(id, student.getUniversityEmail(), student.getFullName(),
                offering.getCourse().getCode(), offering.getAcademicTerm(), summary.getDateFrom(), summary.getDateTo(),
                summary.getSummary(), summary.getStrengths(), summary.getNextSteps());
        String snapshot = json.writeValueAsString(message);

        // Address/name or serializer changes cannot grant another send. Only a new explicit review can.
        String key = digest(id + ":" + summary.getReviewedAt());
        var previous = deliveries.findById(key);
        if (previous.isPresent()) {
            var delivery = previous.get();
            var result = "PROCESSING".equals(delivery.status()) ? UNKNOWN
                    : new ReportEmailGateway.DeliveryResult(delivery.status(), delivery.message());
            return new Claim(key, summary.getReviewedAt(), null, result);
        }
        // Preserve old successful sends without claiming their exact historical payload is known.
        if (summary.getEmailedAt() != null && !summary.getEmailedAt().isBefore(summary.getReviewedAt())) {
            var result = new ReportEmailGateway.DeliveryResult("SENT", "This reviewed summary was already emailed.");
            return new Claim(key, summary.getReviewedAt(), null, result);
        }
        deliveries.saveAndFlush(new FeedbackEmailDelivery(key, id, snapshot));
        return new Claim(key, summary.getReviewedAt(), message, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(UUID id, Claim claim, ReportEmailGateway.DeliveryResult result) {
        var summary = summaries.findForDelivery(id).orElseThrow();
        var delivery = deliveries.findById(claim.key()).orElseThrow();
        delivery.complete(result.status(), result.message());
        deliveries.saveAndFlush(delivery);
        if ("SENT".equals(result.status()) && Objects.equals(summary.getReviewedAt(), claim.reviewedAt())) {
            summary.setEmailedAt(Instant.now());
        }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    record Claim(String key, Instant reviewedAt, ReportEmailGateway.EmailMessage message,
                 ReportEmailGateway.DeliveryResult previous) { }
}
