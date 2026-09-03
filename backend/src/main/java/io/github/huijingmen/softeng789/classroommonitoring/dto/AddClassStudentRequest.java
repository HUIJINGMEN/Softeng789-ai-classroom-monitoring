package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddClassStudentRequest(@NotNull UUID studentId) {
}
