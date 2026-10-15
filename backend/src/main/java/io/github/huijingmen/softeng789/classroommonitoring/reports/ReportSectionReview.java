package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.Instant;
import java.util.List;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.springframework.http.HttpStatus.CONFLICT;

/** Shared review policy, independent of the student or class document shape. */
final class ReportSectionReview {
    private ReportSectionReview() { }
    static List<Section> merge(List<Section> fresh, List<Section> saved) {
        return fresh.stream().map(section -> {
            var old = saved.stream().filter(item -> item.topic() == section.topic()).findFirst();
            if (old.isEmpty()) return section;
            Section previous = old.get();
            if (previous.fingerprint().equals(section.fingerprint())) return previous;
            return new Section(section.topic(), section.title(), section.evidence(), section.fingerprint(),
                    previous.text(), previous.provider(), false, true, null, null);
        }).toList();
    }
    static Section edit(Section old, Edit edit, String reviewer) {
        if (old.stale() && edit.approve() && !edit.evidenceReviewed()) throw new ResponseStatusException(CONFLICT,
                "Check this wording against the updated source records and confirm that review before approval.");
        return new Section(old.topic(), old.title(), old.evidence(), old.fingerprint(), edit.text().trim(),
                old.provider().isBlank() ? "MANUAL" : old.provider(), edit.approve(), old.stale() && !edit.approve(),
                reviewer, edit.approve() ? Instant.now() : null);
    }
    static void requireReviewed(List<Section> sections) {
        if (sections.isEmpty() || sections.stream().anyMatch(section -> !section.reviewed() || section.stale() || section.text().isBlank()))
            throw new ResponseStatusException(CONFLICT, "Review every report section before delivery.");
    }
    static void requireCurrentPolicy(List<Section> sections) {
        if (sections.stream().anyMatch(section -> !ReportEvidence.current(section))) throw new ResponseStatusException(CONFLICT,
                "Report drafting rules changed. Reopen preparation and update outdated drafts before approval or delivery.");
    }
}
