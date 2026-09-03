package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.UUID;

/** Lightweight class + roster picker for the health-incident manual-report form — scoped
 *  server-side to the caller's own classes for a TEACHER, or every class for an ADMIN. */
public record TeacherClassOptionResponse(
        UUID courseOfferingId,
        String label,
        List<StudentOptionResponse> students
) {
}
