package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.MembershipInterval;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PayPerLessonTrigger;
import java.math.BigDecimal;

public record ClassBillingPlanResponse(
        CoursePurchaseMode purchaseMode,
        BigDecimal defaultPrice,
        String currency,
        Integer defaultSessionCount,
        Integer packageValidityDays,
        AbsenceBillingPolicy absencePolicy,
        MembershipInterval membershipInterval,
        Integer sessionsPerPeriod,
        PayPerLessonTrigger payPerLessonTrigger
) {
}
