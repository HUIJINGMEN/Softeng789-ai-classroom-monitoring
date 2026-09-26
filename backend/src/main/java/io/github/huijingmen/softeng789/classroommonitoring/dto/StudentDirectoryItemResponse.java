package io.github.huijingmen.softeng789.classroommonitoring.dto;

/** One roster row plus the derived metric used for global attendance sorting. */
public record StudentDirectoryItemResponse(
        StudentResponse student,
        Integer attendanceRate
) {
}
