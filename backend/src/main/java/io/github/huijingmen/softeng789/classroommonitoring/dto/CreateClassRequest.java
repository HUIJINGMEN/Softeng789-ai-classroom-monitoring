package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;

public record CreateClassRequest(
        @NotBlank String courseCode,
        @NotBlank String academicTerm,
        List<UUID> teacherIds
) {
}
