package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * The client expands a reusable weekly template into explicit session occurrences before sending
 * it. That keeps schedule creation flexible: each weekday can use a different time, teacher or
 * room, holidays can be removed, and the server can validate the whole result in one transaction.
 */
public record CreateClassroomScheduleRequest(
        @NotNull UUID courseOfferingId,
        @NotEmpty @Size(max = 200) List<@NotNull @Valid ClassroomScheduleSessionRequest> sessions,
        Boolean allowConflicts
) {
}
