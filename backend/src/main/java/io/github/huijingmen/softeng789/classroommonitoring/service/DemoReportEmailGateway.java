package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FeedbackSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.report-email.provider", havingValue = "demo", matchIfMissing = true)
public class DemoReportEmailGateway implements ReportEmailGateway {
    private static final Logger log = LoggerFactory.getLogger(DemoReportEmailGateway.class);

    @Override
    public DeliveryResult send(FeedbackSummary summary) {
        log.info("DEMO report email for summary {} to {}", summary.getId(),
                summary.getStudent().getUniversityEmail());
        return new DeliveryResult(
                "DEMO",
                "Email delivery is in demo mode. The report was prepared but no external email was sent."
        );
    }
}
