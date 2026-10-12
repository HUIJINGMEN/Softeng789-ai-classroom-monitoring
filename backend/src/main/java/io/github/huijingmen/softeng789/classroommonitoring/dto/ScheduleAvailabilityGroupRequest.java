package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ScheduleAvailabilityGroupRequest(
        @NotBlank @Size(max = 32) String key,
        @NotEmpty @Size(max = 200) List<@NotNull @Valid ScheduleAvailabilitySlotRequest> slots
) {
}
