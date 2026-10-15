package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.List;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Version rendered facts as well as narrative evidence; preparation timestamps are deliberately excluded. */
final class ReportSnapshotReview {
    private ReportSnapshotReview() { }
    static Section bind(Section section, Object facts) {
        return new Section(section.topic(), section.title(), section.evidence(),
                section.fingerprint() + ":" + ReportEvidence.fingerprint(String.valueOf(facts)), section.text(),
                section.provider(), section.reviewed(), section.stale(), section.reviewedBy(), section.reviewedAt());
    }
    static List<Section> student(List<Section> sections, Snapshot snapshot) {
        return sections.stream().map(section -> bind(section, switch (section.topic()) {
            case ATTENDANCE -> List.of(snapshot.student(), snapshot.courses(), snapshot.attendanceTrend(),
                    snapshot.confirmedEvents(), snapshot.sources().lessons(), snapshot.sources().pendingCorrections());
            case PAYMENTS -> snapshot.payments();
            case ABSENCES -> snapshot.sources().lessons();
            case LEARNING -> snapshot.sources().feedback();
            case ACHIEVEMENTS -> snapshot.sources().achievements();
            default -> List.of();
        })).toList();
    }
    static List<Section> classroom(List<Section> sections, ClassReportModels.Snapshot snapshot) {
        return sections.stream().map(section -> bind(section, switch (section.topic()) {
            case ATTENDANCE -> List.of(snapshot.course(), snapshot.students(), snapshot.studentCount(), snapshot.sessions(),
                    snapshot.attendanceTrend(), snapshot.confirmedEvents());
            case PAYMENTS -> snapshot.payments();
            case ABSENCES -> snapshot.sessions();
            case LEARNING -> snapshot.sources().feedback();
            default -> List.of();
        })).toList();
    }
}
