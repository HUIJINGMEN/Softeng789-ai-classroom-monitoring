package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateCampusRequest(@NotBlank String name) {
}
