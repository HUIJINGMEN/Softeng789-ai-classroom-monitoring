package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.MembershipInterval;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PayPerLessonTrigger;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record UpdateClassBillingPlanRequest(
        @NotNull CoursePurchaseMode purchaseMode,
        @DecimalMin("0.01") BigDecimal defaultPrice,
        @Min(1) @Max(500) Integer defaultSessionCount,
        @Min(1) @Max(3650) Integer packageValidityDays,
        AbsenceBillingPolicy absencePolicy,
        MembershipInterval membershipInterval,
        @Min(1) @Max(500) Integer sessionsPerPeriod,
        PayPerLessonTrigger payPerLessonTrigger
) {
}
