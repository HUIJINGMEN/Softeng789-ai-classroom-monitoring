package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record FaceEnrollmentCaptureMetadata(
        String pose,
        String label,
        double qualityScore,
        double poseScore,
        String capturedAt,
        Boolean optional
) {
}
