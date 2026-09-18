package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateAccomplishmentsRequest(
        @NotNull UUID courseOfferingId,
        @NotNull Accomplishment.Category category,
        @NotBlank @Size(max = 160) String title,
        @Size(max = 4000) String description,
        @NotNull LocalDate achievementDate,
        boolean includeInReport,
        boolean confirm,
        @NotEmpty List<@Valid AccomplishmentEntryRequest> entries
) {
}
