package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.invoice-email.provider", havingValue = "smtp")
public class SmtpInvoiceEmailGateway implements InvoiceEmailGateway {
    private final JavaMailSender mailSender;
    private final String from;

    public SmtpInvoiceEmailGateway(
            JavaMailSender mailSender,
            @Value("${app.invoice-email.from:no-reply@classlens.local}") String from
    ) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public DeliveryResult send(Message message) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true);
            helper.setFrom(from);
            helper.setTo(message.recipientEmail());
            helper.setSubject(message.subject());
            helper.setText(message.body());
            helper.addAttachment(message.attachmentName(), new ByteArrayResource(message.attachment()));
            mailSender.send(mimeMessage);
            return new DeliveryResult("SENT", "Invoice sent to " + message.recipientEmail() + ".");
        } catch (MessagingException exception) {
            throw new IllegalStateException("The invoice email could not be prepared.", exception);
        }
    }
}
