package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.List;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Audience;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Document;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;

/** Defense in depth for legacy/malformed partner snapshots; free-text still needs human privacy review. */
final class OverallReportPrivacy {
    private OverallReportPrivacy() { }

    static Document project(Document document) {
        if (document.audience() != Audience.PARTNER) return document;
        var s = document.snapshot();
        var safe = new Snapshot(s.preparedAt(), s.preparedBy(), s.allCourses(), s.studentCount(), s.completedSessions(),
                s.attendance(), s.attendanceTrend(), s.confirmedEvents(), s.courses(), s.feedbackCount(), s.achievements(),
                List.of(), List.of());
        return new Document(document.dateFrom(), document.dateTo(), document.audience(), document.courseOfferingIds(),
                document.sections(), safe);
    }
}
