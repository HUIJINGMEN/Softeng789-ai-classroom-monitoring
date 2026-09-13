package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;

public record StudentAttendanceBenchmarkResponse(
        Integer overallAverageRate,
        long participatingMarks,
        long totalMarks,
        int studentCount,
        List<CourseAttendanceBenchmarkResponse> courses
) {
}
