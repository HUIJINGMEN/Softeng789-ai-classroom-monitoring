package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record AddClassStudentsRequest(@NotEmpty List<UUID> studentIds) {
}
