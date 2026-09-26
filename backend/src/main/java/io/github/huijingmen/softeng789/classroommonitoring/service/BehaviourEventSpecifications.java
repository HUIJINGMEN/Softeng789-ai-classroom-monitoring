package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent.ReviewStatus;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

final class BehaviourEventSpecifications {
    private BehaviourEventSpecifications() {
    }

    static Specification<BehaviourEvent> visibleDirectory(
            UUID callerId,
            boolean admin,
            ReviewStatus reviewStatus,
            String course,
            UUID sessionId,
            String eventType,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        return (root, criteriaQuery, builder) -> {
            var session = root.join("session");
            var predicates = new ArrayList<Predicate>();
            if (!admin) {
                predicates.add(builder.equal(
                        session.join("courseOffering").join("teachers").get("id"),
                        callerId
                ));
            }
            if (reviewStatus != null) {
                predicates.add(builder.equal(root.get("reviewStatus"), reviewStatus));
            }
            if (hasText(course)) {
                predicates.add(builder.equal(
                        builder.lower(session.<String>get("course")),
                        course.trim().toLowerCase(Locale.ROOT)
                ));
            }
            if (sessionId != null) {
                predicates.add(builder.equal(session.get("id"), sessionId));
            }
            if (hasText(eventType)) {
                predicates.add(builder.equal(
                        builder.lower(root.<String>get("eventType")),
                        eventType.trim().toLowerCase(Locale.ROOT)
                ));
            }
            if (dateFrom != null) {
                predicates.add(builder.greaterThanOrEqualTo(session.<LocalDate>get("date"), dateFrom));
            }
            if (dateTo != null) {
                predicates.add(builder.lessThanOrEqualTo(session.<LocalDate>get("date"), dateTo));
            }

            if (!Long.class.equals(criteriaQuery.getResultType())) {
                var reviewPriority = builder.<Integer>selectCase()
                        .when(builder.equal(root.get("reviewStatus"), ReviewStatus.PENDING_REVIEW), 0)
                        .when(builder.equal(root.get("reviewStatus"), ReviewStatus.CONFIRMED), 1)
                        .when(builder.equal(root.get("reviewStatus"), ReviewStatus.CORRECTED), 2)
                        .otherwise(3);
                criteriaQuery.orderBy(
                        builder.asc(reviewPriority),
                        builder.desc(root.get("timestamp")),
                        builder.desc(root.get("id"))
                );
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
