package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.UUID;

/** Lightweight class listing for the session-scheduling dropdown — any signed-in staff can see it. */
public record ClassSummaryResponse(
        UUID id,
        String courseCode,
        String offeringCode,
        String academicTerm,
        List<ClassTeacherSummary> teachers
) {
}
