package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import java.util.List;
import java.util.UUID;

public record FaceEnrollmentResponse(
        UUID studentId,
        boolean imageAccepted,
        boolean aiVerified,
        FaceEnrollmentStatus status,
        String message,
        String photoUrl,
        List<FaceEnrollmentCaptureResponse> captures
) {
}
