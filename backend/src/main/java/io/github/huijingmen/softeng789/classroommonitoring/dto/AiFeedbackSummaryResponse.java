package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record AiFeedbackSummaryResponse(
        String summary,
        String strengths,
        String nextSteps,
        String provider
) {
}
