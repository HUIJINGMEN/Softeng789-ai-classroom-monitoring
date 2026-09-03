package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TransferStudentRequest(@NotNull UUID toClassId) {
}
