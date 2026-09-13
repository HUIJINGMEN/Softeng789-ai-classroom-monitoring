package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

/** Stable mobile contract for student recognition. The current implementation reports DEMO mode;
 * the future lab AI adapter can return AI_SERVICE without changing the iPhone workflow. */
public record StudentRecognitionResponse(
        UUID studentId,
        String studentName,
        String studentNumber,
        double confidence,
        String mode
) {
}
