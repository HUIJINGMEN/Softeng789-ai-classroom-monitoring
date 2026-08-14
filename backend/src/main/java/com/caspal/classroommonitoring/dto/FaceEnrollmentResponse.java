package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.FaceEnrollmentStatus;
import java.util.UUID;

public record FaceEnrollmentResponse(
        UUID studentId,
        boolean imageAccepted,
        boolean aiVerified,
        FaceEnrollmentStatus status,
        String message,
        String photoUrl
) {
}
