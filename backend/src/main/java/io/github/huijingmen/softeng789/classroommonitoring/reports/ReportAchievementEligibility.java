package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentFeedbackRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Both personal and institution reports exclude unresolved corrections, without reading private messages. */
@Component
public class ReportAchievementEligibility {
    private final AccomplishmentFeedbackRepository corrections;
    public ReportAchievementEligibility(AccomplishmentFeedbackRepository corrections) { this.corrections = corrections; }

    record Selection(List<Accomplishment> included, List<Accomplishment> pending) { }

    Selection select(List<Accomplishment> candidates) {
        if (candidates.isEmpty()) return new Selection(List.of(), List.of());
        Set<UUID> pending = Set.copyOf(corrections.findAccomplishmentIdsByTypeAndStatus(
                candidates.stream().map(Accomplishment::getId).toList(),
                AccomplishmentFeedback.Type.CORRECTION_REQUEST, AccomplishmentFeedback.Status.PENDING));
        return new Selection(candidates.stream().filter(row -> !pending.contains(row.getId())).toList(),
                candidates.stream().filter(row -> pending.contains(row.getId())).toList());
    }
}
