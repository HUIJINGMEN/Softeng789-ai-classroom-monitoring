package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.UUID;

public record ClassResponse(
        UUID id,
        String courseCode,
        String offeringCode,
        String academicTerm,
        String status,
        List<ClassTeacherSummary> teachers,
        long studentCount
) {
}
