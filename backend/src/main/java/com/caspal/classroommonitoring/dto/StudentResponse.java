package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.FaceEnrollmentStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudentResponse(
        UUID id,
        String studentNumber,
        String universityEmail,
        String firstName,
        String lastName,
        String course,
        List<String> courses,
        String seat,
        String programme,
        boolean consentGiven,
        FaceEnrollmentStatus faceEnrollmentStatus,
        String registrationPhotoUrl,
        Instant createdAt,
        Instant updatedAt
) {
}
