package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ReportSourceEvidenceTest {
    @Test void excerptsAreBoundedByUnicodeCodePointsRatherThanSplittingEmoji() {
        String text = ReportSourceEvidence.excerpt("  " + "🙂".repeat(400) + "  ");
        assertThat(text.codePointCount(0, text.length())).isEqualTo(361);
        assertThat(text).isEqualTo("🙂".repeat(360) + "…");
        assertThat(ReportSourceEvidence.excerpt(null)).isEmpty();
        assertThat(ReportSourceEvidence.excerpt(" Short note ")).isEqualTo("Short note");
    }
    @Test void olderSnapshotsDeserializeWithoutInventingSourceRecords() throws Exception {
        var json = new ObjectMapper().findAndRegisterModules();
        var empty = new ReportModels.AttendanceSummary(0, 0, 0, 0, 0, null);
        var personal = new ReportModels.Snapshot(new ReportModels.StudentInfo("Student", "S1", "s@test", "", "LEVEL_1"),
                List.of(), empty, List.of(), List.of(), 0, new ReportModels.PaymentSnapshot(List.of(), 0));
        var personalJson = (com.fasterxml.jackson.databind.node.ObjectNode) json.valueToTree(personal);
        personalJson.remove("sources");
        assertThat(json.treeToValue(personalJson, ReportModels.Snapshot.class).sources()).isNull();
        var classroom = new ClassReportModels.Snapshot(null, null, 0, empty, List.of(), List.of(), List.of(), List.of(),
                0, new ClassReportModels.Payments(List.of(), 0, 0));
        var classJson = (com.fasterxml.jackson.databind.node.ObjectNode) json.valueToTree(classroom);
        classJson.remove("sources");
        assertThat(json.treeToValue(classJson, ClassReportModels.Snapshot.class).sources()).isNull();
    }
    @Test void legacyClassRosterIsPreservedWithoutRetiredPersonalFollowUps() throws Exception {
        var json = new ObjectMapper().findAndRegisterModules();
        String raw = "{\"students\":[{\"id\":\"00000000-0000-0000-0000-000000000001\",\"name\":\"Private Student\",\"number\":\"PRIVATE-ID\"}],"
                + "\"sources\":{\"feedback\":[],\"followUps\":[{\"name\":\"Private Student\"}]}}";
        var snapshot = json.readValue(raw, ClassReportModels.Snapshot.class);
        assertThat(snapshot.studentCount()).isEqualTo(1);
        assertThat(snapshot.students()).hasSize(1);
        assertThat(json.writeValueAsString(snapshot)).contains("Private Student", "PRIVATE-ID", "\"students\"").doesNotContain("followUps");
        assertThat(raw).contains("Private Student");
    }
}
