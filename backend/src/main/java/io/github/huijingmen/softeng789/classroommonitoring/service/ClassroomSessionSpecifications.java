package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import jakarta.persistence.criteria.JoinType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

final class ClassroomSessionSpecifications {
    private ClassroomSessionSpecifications() {
    }

    static Specification<ClassroomSession> visibleDirectory(
            UUID callerId,
            boolean admin,
            String query
    ) {
        String normalised = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String pattern = "%" + normalised + "%";
        return (root, criteriaQuery, builder) -> {
            criteriaQuery.distinct(true);
            var visible = admin
                    ? builder.conjunction()
                    : builder.equal(
                            root.join("courseOffering").join("teachers").get("id"),
                            callerId
                    );
            if (normalised.isEmpty()) {
                return visible;
            }
            var teacher = root.join("teacher", JoinType.LEFT);
            var room = root.join("roomEntity", JoinType.LEFT);
            var campus = room.join("campus", JoinType.LEFT);
            var matchesText = builder.or(
                    builder.like(builder.lower(root.get("course")), pattern),
                    builder.like(builder.lower(root.get("room")), pattern),
                    builder.like(builder.lower(teacher.get("name")), pattern),
                    builder.like(builder.lower(teacher.get("email")), pattern),
                    builder.like(builder.lower(campus.get("name")), pattern),
                    builder.like(builder.lower(root.get("status").as(String.class)), pattern)
            );
            try {
                LocalDate date = LocalDate.parse(normalised);
                return builder.and(visible, builder.or(matchesText, builder.equal(root.get("date"), date)));
            } catch (DateTimeParseException ignored) {
                return builder.and(visible, matchesText);
            }
        };
    }
}
