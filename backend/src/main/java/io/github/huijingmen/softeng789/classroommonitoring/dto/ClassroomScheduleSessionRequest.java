package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * One concrete occurrence produced from the Admin's reusable weekly timetable template.
 * Keeping the room, teacher and clock time on each occurrence allows Monday, Wednesday and
 * Friday to follow different rules while the whole schedule is still created transactionally.
 */
public record ClassroomScheduleSessionRequest(
        @NotNull LocalDate date,
        @NotNull UUID scheduleSeriesId,
        @NotNull UUID roomId,
        String teacherEmail,
        String teacherStaffNumber,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime
) {
}
