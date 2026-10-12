package io.github.huijingmen.softeng789.classroommonitoring.support.dto;

import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveLessonTreatment;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class StudentSupportRequestDtos {
    private StudentSupportRequestDtos() {
    }

    public enum ReviewDecision {
        APPROVE,
        DECLINE,
        RESOLVE
    }

    public record CreateStudentSupportRequest(
            @NotNull StudentRequestType type,
            @NotNull StudentRequesterRole requesterRole,
            @Size(max = 160) String contactName,
            @Size(max = 80) String relationshipToStudent,
            @Email @Size(max = 255) String contactEmail,
            @Size(max = 40) String contactPhone,
            UUID courseOfferingId,
            UUID sessionId,
            LeaveReason leaveReason,
            @NotBlank @Size(max = 160) String subject,
            @NotBlank @Size(max = 2000) String message
    ) {
    }

    public record ReviewStudentSupportRequest(
            @NotNull ReviewDecision decision,
            @NotBlank @Size(max = 2000) String note,
            LeaveLessonTreatment lessonTreatment
    ) {
        public ReviewStudentSupportRequest(ReviewDecision decision, String note) {
            this(decision, note, null);
        }
    }

    public record StudentSupportRequestResponse(
            UUID id,
            UUID studentId,
            String studentName,
            String studentNumber,
            String studentEmail,
            StudentRequesterRole requesterRole,
            String contactName,
            String relationshipToStudent,
            String contactEmail,
            String contactPhone,
            StudentRequestType type,
            StudentRequestStatus status,
            UUID courseOfferingId,
            String courseCode,
            String courseName,
            UUID sessionId,
            LocalDate sessionDate,
            Instant sessionStartTime,
            Instant sessionEndTime,
            LeaveReason leaveReason,
            boolean lessonTreatmentRequired,
            LeaveLessonTreatment lessonTreatment,
            String subject,
            String message,
            String reviewNote,
            Instant submittedAt,
            Instant reviewedAt
    ) {
    }

    public record AdminStudentSupportRequestsResponse(
            long submittedCount,
            PageResponse<StudentSupportRequestResponse> page
    ) {
    }
}
