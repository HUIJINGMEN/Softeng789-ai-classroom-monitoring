package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LessonReconciliationExportServiceTest {
    @Test
    void createsAValidWorkbookPackageAndPdf() throws Exception {
        LessonReconciliationService reconciliation = mock(LessonReconciliationService.class);
        UUID offeringId = UUID.randomUUID();
        LocalDate weekStart = LocalDate.of(2026, 10, 5);
        LessonReconciliationResponse response = new LessonReconciliationResponse(
                offeringId, "DANCE-30", "Summer 2026", ReconciliationView.WEEK, weekStart, weekStart.plusDays(6),
                List.of(), new ReconciliationSummaryResponse(0, 0, 0, 0, 0, 0, 0),
                List.of(), 0, 100, 0, 0, false, false
        );
        when(reconciliation.reconcile(any(), any(), any(), anyString(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(response);
        LessonReconciliationExportService service = new LessonReconciliationExportService(reconciliation);

        byte[] workbook = service.excel(offeringId, weekStart, ReconciliationView.WEEK, "", false).content();
        List<String> entries = new ArrayList<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(workbook))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                entries.add(entry.getName());
            }
        }
        assertThat(entries).contains("xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/styles.xml");

        byte[] pdf = service.pdf(offeringId, weekStart, ReconciliationView.WEEK, "", false).content();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }
}
