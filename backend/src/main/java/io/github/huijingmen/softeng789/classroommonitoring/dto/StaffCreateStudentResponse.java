package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import java.util.UUID;

public record StaffCreateStudentResponse(
        UUID studentId,
        String fullName,
        String approvalStatus,
        FaceEnrollmentStatus faceEnrollmentStatus,
        boolean reviewRequired
) {
}
