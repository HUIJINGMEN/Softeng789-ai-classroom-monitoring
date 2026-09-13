package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FeedbackSummary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.report-email.provider", havingValue = "smtp")
public class SmtpReportEmailGateway implements ReportEmailGateway {
    private final JavaMailSender mailSender;
    private final String from;

    public SmtpReportEmailGateway(
            JavaMailSender mailSender,
            @Value("${app.report-email.from:no-reply@classroomiq.local}") String from
    ) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public DeliveryResult send(FeedbackSummary summary) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(summary.getStudent().getUniversityEmail());
        message.setSubject("ClassroomIQ progress report — "
                + summary.getCourseOffering().getCourse().getCode());
        message.setText(body(summary));
        mailSender.send(message);
        return new DeliveryResult("SENT", "Report sent to " + summary.getStudent().getUniversityEmail() + ".");
    }

    private String body(FeedbackSummary summary) {
        return "Progress report for " + summary.getStudent().getFullName() + "\n"
                + summary.getCourseOffering().getCourse().getCode() + " · "
                + summary.getCourseOffering().getAcademicTerm() + "\n"
                + summary.getDateFrom() + " to " + summary.getDateTo() + "\n\n"
                + summary.getSummary() + "\n\nStrengths\n" + summary.getStrengths()
                + "\n\nNext steps\n" + summary.getNextSteps()
                + "\n\nThis summary was reviewed by a ClassroomIQ teacher.";
    }
}
