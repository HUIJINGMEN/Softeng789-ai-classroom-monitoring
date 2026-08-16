package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record FaceEnrollmentCaptureResponse(
        String pose,
        String label,
        String photoUrl,
        double qualityScore,
        double poseScore,
        String capturedAt,
        boolean optional
) {
}
