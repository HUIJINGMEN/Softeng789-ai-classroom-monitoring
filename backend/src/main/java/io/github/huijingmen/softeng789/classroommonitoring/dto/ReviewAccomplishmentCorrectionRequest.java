package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ReviewAccomplishmentCorrectionRequest(
        @NotNull AccomplishmentFeedback.Status decision,
        @NotNull Accomplishment.Category category,
        @NotBlank @Size(max = 160) String title,
        @Size(max = 4000) String description,
        @Size(max = 2000) String studentNote,
        @DecimalMin("0.0") BigDecimal points,
        @NotNull LocalDate achievementDate,
        boolean includeInReport,
        @Size(max = 1200) String staffResponse
) {
}
