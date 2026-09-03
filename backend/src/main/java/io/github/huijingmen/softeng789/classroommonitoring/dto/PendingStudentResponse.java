package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PendingStudentResponse(
        UUID id,
        String studentNumber,
        String universityEmail,
        String fullName,
        List<String> requestedClasses,
        FaceEnrollmentStatus faceEnrollmentStatus,
        boolean consentGiven,
        Instant createdAt
) {
}
