package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.UUID;

/** Lightweight class listing for the session-scheduling dropdown and the teacher-facing
 *  read-only "Classes" page — scoped to the caller's own classes unless they're an admin. */
public record ClassSummaryResponse(
        UUID id,
        String courseCode,
        String offeringCode,
        String academicTerm,
        List<ClassTeacherSummary> teachers,
        int studentCount
) {
}
