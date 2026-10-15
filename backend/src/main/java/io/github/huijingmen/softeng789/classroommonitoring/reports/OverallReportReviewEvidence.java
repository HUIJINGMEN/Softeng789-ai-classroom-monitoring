package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.ArrayList;
import java.util.List;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Audience;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;
import io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.Section;

/** Review the rendered factual appendix too; preparation time alone must not invalidate a review. */
final class OverallReportReviewEvidence {
    private OverallReportReviewEvidence() { }

    static List<String> appendix(Snapshot snapshot, Audience audience) {
        List<String> facts = new ArrayList<>();
        facts.add("Eligible confirmed achievement records: " + snapshot.achievements());
        snapshot.confirmedEvents().forEach(row -> facts.add("Confirmed/corrected observations — " + row.type() + ": " + row.count()));
        if (audience == Audience.INTERNAL) {
            snapshot.actions().forEach(row -> facts.add(row.courseLabel() + " — " + row.issue()
                    + ": " + row.count() + ". " + row.nextStep()));
            if (snapshot.students() != null) facts.add("Internal student roster: " + snapshot.students().size()
                    + " distinct students. Review names, courses and attendance before approval.");
        }
        return List.copyOf(facts);
    }
    static Section bindRoster(Section section, Snapshot snapshot, Audience audience) {
        return audience == Audience.INTERNAL && snapshot.students() != null
                ? ReportSnapshotReview.bind(section, snapshot.students()) : section;
    }
}
