package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record CourseAttendanceBenchmarkResponse(
        String course,
        Integer averageRate,
        long participatingMarks,
        long totalMarks,
        int studentCount
) {
}
