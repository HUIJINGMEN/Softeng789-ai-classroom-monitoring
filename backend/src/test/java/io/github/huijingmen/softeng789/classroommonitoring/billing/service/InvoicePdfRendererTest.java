package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InvoicePdfRendererTest {
    private final InvoicePdfRenderer renderer = new InvoicePdfRenderer();

    @Test
    void rendersReadableInvoiceAndSafelyHandlesUnsupportedGlyphs() throws Exception {
        InvoiceDocument invoice = new InvoiceDocument(
                UUID.randomUUID(), "INV-2026-0042", "Term two learning package",
                "李同学", "TEST-0001", "student@example.test",
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 20), "NZD",
                List.of(
                        new InvoiceDocument.Item("Ten supported classroom sessions", LineItemType.CHARGE, new BigDecimal("500.00")),
                        new InvoiceDocument.Item("Learning support credit", LineItemType.CREDIT, new BigDecimal("50.00"))
                ),
                new BigDecimal("500.00"), new BigDecimal("50.00"), BigDecimal.ZERO,
                new BigDecimal("450.00"), null, null,
                "You attended six sessions this term. We look forward to supporting your next four sessions.",
                Instant.parse("2026-10-05T00:00:00Z")
        );

        byte[] pdf = renderer.render(invoice);
        Path preview = Path.of("target", "pdf-preview", "ClassLens-sample-invoice.pdf");
        Files.createDirectories(preview.getParent());
        Files.write(preview, pdf);

        try (var document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            assertThat(text).contains("ClassLens", "INV-2026-0042", "Amount due", "$450.00");
        }
    }
}
