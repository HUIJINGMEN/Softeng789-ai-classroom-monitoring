package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReportDocumentJsonTest {
    record Snapshot(String title, LocalDate date) { }

    @Test void roundTripsTypedSnapshotsWithTheConfiguredMapper() {
        var json = new ObjectMapper().findAndRegisterModules();
        var snapshot = new Snapshot("Reviewed wording", LocalDate.of(2026, 10, 15));
        String stored = ReportDocumentJson.write(json, snapshot, "Could not store report");
        assertThat(ReportDocumentJson.read(json, stored, Snapshot.class, "Invalid stored report"))
                .isEqualTo(snapshot);
    }

    @Test void invalidStoredDataKeepsItsFeatureErrorAndOriginalCause() {
        assertThatThrownBy(() -> ReportDocumentJson.read(new ObjectMapper(), "not JSON", Snapshot.class,
                "Invalid stored class report"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invalid stored class report")
                .hasCauseInstanceOf(JsonProcessingException.class);
    }

    @Test void writeFailureKeepsItsFeatureErrorAndOriginalCause() throws JsonProcessingException {
        var json = mock(ObjectMapper.class);
        var snapshot = new Snapshot("Reviewed wording", LocalDate.of(2026, 10, 15));
        var cause = new JsonProcessingException("Serialization failed") { };
        when(json.writeValueAsString(snapshot)).thenThrow(cause);
        assertThatThrownBy(() -> ReportDocumentJson.write(json, snapshot, "Could not store overall report"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Could not store overall report")
                .hasCause(cause);
    }
}
