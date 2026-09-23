package io.github.huijingmen.softeng789.classroommonitoring.service;

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
    public DeliveryResult send(EmailMessage summary) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(summary.studentEmail());
        message.setSubject("ClassroomIQ progress report — " + summary.courseCode());
        message.setText(body(summary));
        mailSender.send(message);
        return new DeliveryResult("SENT", "Report sent to " + summary.studentEmail() + ".");
    }

    private String body(EmailMessage summary) {
        return "Progress report for " + summary.studentName() + "\n"
                + summary.courseCode() + " · " + summary.academicTerm() + "\n"
                + summary.dateFrom() + " to " + summary.dateTo() + "\n\n"
                + summary.summary() + "\n\nStrengths\n" + summary.strengths()
                + "\n\nNext steps\n" + summary.nextSteps()
                + "\n\nThis summary was reviewed by a ClassroomIQ teacher.";
    }
}
