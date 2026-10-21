package io.github.huijingmen.softeng789.classroommonitoring.config;

import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Validates configuration only: startup must not send a test email or contact a provider. */
@Component
@Profile("production | prod")
public class ProductionMailPolicy {
    public ProductionMailPolicy(Environment environment) {
        require("smtp".equals(environment.getProperty("app.report-email.provider")),
                "app.report-email.provider must be smtp.");
        require("smtp".equals(environment.getProperty("app.invoice-email.provider")),
                "app.invoice-email.provider must be smtp.");
        require("smtp".equals(environment.getProperty("app.auth.account-email.provider")),
                "app.auth.account-email.provider must be smtp.");
        requireSender(environment, "app.report-email.from");
        requireSender(environment, "app.invoice-email.from");
        requireSender(environment, "app.auth.account-email.from");
        for (String property : new String[]{"spring.mail.host", "spring.mail.username", "spring.mail.password"}) {
            require(hasText(environment.getProperty(property)), property + " must be configured.");
        }
        require(!hasText(environment.getProperty("spring.mail.jndi-name")),
                "spring.mail.jndi-name is not supported by this production SMTP contract.");
        require("smtp".equals(environment.getProperty("spring.mail.protocol", "smtp")),
                "spring.mail.protocol must be smtp; use SSL or required STARTTLS for encryption.");
        Integer port = environment.getProperty("spring.mail.port", Integer.class);
        require(port != null && port > 0 && port <= 65535, "spring.mail.port must be configured (1–65535).");
        require(flag(environment, "mail.smtp.auth"), "mail.smtp.auth must be enabled.");
        boolean ssl = environment.getProperty("spring.mail.ssl.enabled", Boolean.class, false)
                || flag(environment, "mail.smtp.ssl.enable");
        boolean startTls = flag(environment, "mail.smtp.starttls.enable")
                && flag(environment, "mail.smtp.starttls.required");
        require(ssl || startTls, "SMTP must use SSL or required STARTTLS.");
        require(flag(environment, "mail.smtp.ssl.checkserveridentity")
                        && environment.getProperty("spring.mail.ssl.verify-hostname", Boolean.class, true),
                "SMTP hostname verification must be enabled.");
        require(!"*".equals(environment.getProperty("spring.mail.properties.mail.smtp.ssl.trust")),
                "SMTP must not trust every server certificate.");
        for (String timeout : new String[]{"connectiontimeout", "timeout", "writetimeout"}) {
            Integer milliseconds = environment.getProperty("spring.mail.properties.mail.smtp." + timeout, Integer.class);
            require(milliseconds != null && milliseconds > 0 && milliseconds <= 30000,
                    "SMTP " + timeout + " must be between 1 and 30000 milliseconds.");
        }
    }

    private static boolean flag(Environment environment, String property) {
        return environment.getProperty("spring.mail.properties." + property, Boolean.class, false);
    }

    private static void requireSender(Environment environment, String property) {
        String sender = environment.getProperty(property);
        require(hasText(sender), property + " must be configured.");
        try {
            InternetAddress address = new InternetAddress(sender, true);
            address.validate();
            String mailbox = address.getAddress();
            String domain = mailbox.substring(mailbox.lastIndexOf('@') + 1).toLowerCase(java.util.Locale.ROOT);
            require(domain.contains(".") && !domain.endsWith(".local"),
                    property + " must use a real sender domain, not a local demo address.");
        } catch (AddressException exception) {
            throw new IllegalStateException(property + " must be one valid sender address.");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException("Production mail configuration: " + message);
    }
}
