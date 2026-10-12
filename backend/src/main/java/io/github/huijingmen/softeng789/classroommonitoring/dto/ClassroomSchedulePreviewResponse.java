package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.LocalDate;
import java.util.List;

public record ClassroomSchedulePreviewResponse(
        List<LocalDate> dates,
        List<ScheduleConflictResponse> conflicts
) {
}
