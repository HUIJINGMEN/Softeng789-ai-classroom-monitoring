package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.UUID;

public record CreateRoomRequest(
        @NotNull UUID campusId,
        @NotBlank String code,
        @NotBlank String name,
        @PositiveOrZero int capacity
) {
}
