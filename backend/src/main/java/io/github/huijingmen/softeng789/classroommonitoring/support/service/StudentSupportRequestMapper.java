package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.StudentSupportRequestResponse;
import org.springframework.stereotype.Component;

/** Maps the support aggregate to its API projection without owning workflow decisions. */
@Component
public class StudentSupportRequestMapper {
    public StudentSupportRequestResponse toResponse(
            StudentSupportRequest request,
            boolean lessonTreatmentRequired
    ) {
        CourseOffering offering = request.getCourseOffering();
        ClassroomSession session = request.getSession();
        return new StudentSupportRequestResponse(
                request.getId(),
                request.getStudent().getId(),
                request.getStudent().getFullName(),
                request.getStudent().getStudentNumber(),
                request.getStudent().getUniversityEmail(),
                request.getRequesterRole(),
                request.getContactName(),
                request.getRelationshipToStudent(),
                request.getContactEmail(),
                request.getContactPhone(),
                request.getType(),
                request.getStatus(),
                offering == null ? null : offering.getId(),
                offering == null ? null : offering.getCourse().getCode(),
                offering == null ? null : offering.getCourse().getName(),
                session == null ? null : session.getId(),
                session == null ? null : session.getDate(),
                session == null ? null : session.getStartTime(),
                session == null ? null : session.getEndTime(),
                request.getLeaveReason(),
                lessonTreatmentRequired,
                request.getLeaveLessonTreatment(),
                request.getSubject(),
                request.getMessage(),
                request.getReviewNote(),
                request.getSubmittedAt(),
                request.getReviewedAt()
        );
    }
}
