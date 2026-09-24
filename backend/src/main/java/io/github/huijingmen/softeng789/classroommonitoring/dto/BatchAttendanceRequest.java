package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record BatchAttendanceRequest(
        @NotEmpty
        @Size(max = 100, message = "A maximum of 100 classroom sessions can be requested at once.")
        List<@NotNull UUID> sessionIds
) {
}
