package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FeedbackSummary;

public interface ReportEmailGateway {
    DeliveryResult send(FeedbackSummary summary);

    record DeliveryResult(String status, String message) {
    }
}
