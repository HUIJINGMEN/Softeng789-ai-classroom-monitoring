package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record AiFaceEnrollmentResponse(
        String studentId,
        boolean imageAccepted,
        boolean aiVerified,
        String status,
        String message
) {
}
