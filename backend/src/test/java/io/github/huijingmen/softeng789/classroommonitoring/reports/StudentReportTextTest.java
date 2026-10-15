package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class StudentReportTextTest {
    @Test void emailContainsPersonalRecordsWithoutClassroomMetadataOrDuplicateCourseNames() {
        var attendance = new AttendanceSummary(8, 3, 1, 2, 2, 67);
        var course = new CourseSummary(UUID.randomUUID(), "SOFTENG 789", "SOFTENG 789",
                "CLASSROOM-ONLY-TERM", List.of("Classroom-only instructor"), "WITHDRAWN", attendance);
        var snapshot = new Snapshot(new StudentInfo("Example Student", "EXAMPLE-001",
                "student@example.test", "Engineering", "LEVEL_2"), List.of(course), attendance,
                List.of(new AttendancePoint(LocalDate.of(2026, 10, 5), attendance)),
                List.of(new EventCount("Hand raise", 4)), 1, new PaymentSnapshot(List.of(), 0));
        var document = new Document(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 12),
                List.of(course.id()), List.of("SOFTENG 789"), List.of(), snapshot);

        assertThat(StudentReportText.render(document))
                .contains("Example Student", "EXAMPLE-001", "Student course record\nSOFTENG 789; lessons attended: 4",
                        "absences: 2; attendance rate: 67%", "Student attendance", "Weekly attendance",
                        "Only this student's lessons", "Confirmed observations for this student\nHand raise: 4")
                .doesNotContain("Classroom-only instructor", "CLASSROOM-ONLY-TERM", "WITHDRAWN", "teachers:",
                        "SOFTENG 789 · SOFTENG 789", "Weekly participation");
    }
}
