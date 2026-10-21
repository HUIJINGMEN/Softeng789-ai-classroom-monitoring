package io.github.huijingmen.softeng789.classroommonitoring.reports;

import tools.jackson.databind.json.JsonMapper;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway.DeliveryResult;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway.EmailMessage;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.springframework.http.HttpStatus.*;

/** Claims commit before SMTP. Revision locking and durable receipts also cover retries from other tabs. */
@Service
public class StudentReportEmailService {
    private static final Logger LOG = LoggerFactory.getLogger(StudentReportEmailService.class);
    private static final DeliveryResult UNKNOWN = new DeliveryResult("UNKNOWN",
            "Email delivery could not be confirmed. It will not be sent again automatically. "
            + "Check with the recipient or your mail administrator before arranging another delivery. PDF and portal delivery are still available.");
    private final StudentReportRepository reports;
    private final StudentReportEmailRepository deliveries;
    private final StudentReportEvidence evidence;
    private final StudentRepository students;
    private final JsonMapper json;
    private final ReportEmailGateway gateway;
    private final TransactionTemplate transactions;

    public StudentReportEmailService(StudentReportRepository reports, StudentReportEmailRepository deliveries,
            StudentReportEvidence evidence, StudentRepository students, JsonMapper json,
            ReportEmailGateway gateway, PlatformTransactionManager manager) {
        this.reports = reports; this.deliveries = deliveries; this.evidence = evidence;
        this.students = students; this.json = json; this.gateway = gateway;
        this.transactions = new TransactionTemplate(manager);
    }

    public DeliveryResult deliver(UUID id, long version, UUID caller) {
        Claim claim = Objects.requireNonNull(transactions.execute(status -> claim(id, version, caller)));
        if (claim.previous() != null) return claim.previous();
        DeliveryResult result;
        try {
            result = Objects.requireNonNull(gateway.send(claim.message()));
            if (!"SENT".equals(result.status()) && !"DEMO".equals(result.status())) result = UNKNOWN;
        } catch (RuntimeException exception) {
            LOG.warn("Report email outcome unconfirmed for delivery {} ({})", claim.deliveryId(), exception.getClass().getSimpleName());
            result = UNKNOWN;
        }
        DeliveryResult outcome = result;
        try {
            transactions.executeWithoutResult(status -> {
                var delivery = deliveries.findById(claim.deliveryId()).orElseThrow();
                delivery.complete(outcome.status(), outcome.message());
                deliveries.saveAndFlush(delivery);
            });
        } catch (RuntimeException exception) {
            // A persisted PROCESSING claim remains a no-resend barrier after a crash or DB outage.
            LOG.warn("Could not record report email outcome for delivery {}", claim.deliveryId());
            return UNKNOWN;
        }
        return outcome;
    }

    private Claim claim(UUID id, long version, UUID caller) {
        var report = reports.findForDelivery(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Report not found."));
        Document document = read(report);
        evidence.authorize(report.getStudentId(), document.courseOfferingIds(), caller);
        var existing = deliveries.findByReportIdAndReportVersion(id, version);
        if (existing.isPresent()) {
            var delivery = existing.get();
            DeliveryResult previous = "PROCESSING".equals(delivery.getStatus()) ? UNKNOWN
                    : new DeliveryResult(delivery.getStatus(), delivery.getMessage());
            return new Claim(delivery.getId(), null, previous);
        }
        if (!Objects.equals(report.getVersion(), version)) throw new ResponseStatusException(CONFLICT,
                "This report changed in another window. Reopen the preview before emailing it.");
        StudentReportService.requireReviewed(document);
        if (report.getPublishedAt() == null) StudentReportService.requireCurrentPolicy(document);
        var student = students.findById(report.getStudentId()).orElseThrow();
        String recipient = student.getUniversityEmail();
        if (recipient == null || recipient.isBlank()) throw new ResponseStatusException(BAD_REQUEST, "The student has no email address.");
        var message = new EmailMessage(id, recipient, student.getFullName(), "Student report",
                String.join("; ", document.courseLabels()), document.dateFrom(), document.dateTo(),
                "", "", "", StudentReportText.render(document));
        var delivery = deliveries.saveAndFlush(new StudentReportEmailDelivery(id, version));
        return new Claim(delivery.getId(), message, null);
    }

    private Document read(StudentReport report) {
        return ReportDocumentJson.read(json, report.getDocument(), Document.class, "Invalid stored report");
    }
    private record Claim(UUID deliveryId, EmailMessage message, DeliveryResult previous) { }
}
