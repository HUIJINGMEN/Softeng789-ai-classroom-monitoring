package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationCellResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

@Service
public class LessonReconciliationExportService {
    private static final int EXPORT_PAGE_SIZE = 100;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH);
    private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    private final LessonReconciliationService reconciliationService;

    public LessonReconciliationExportService(LessonReconciliationService reconciliationService) {
        this.reconciliationService = reconciliationService;
    }

    public ExportDocument excel(
            UUID offeringId,
            LocalDate weekStart,
            ReconciliationView view,
            String query,
            boolean exceptionsOnly
    ) {
        ExportData data = data(offeringId, weekStart, view, query, exceptionsOnly);
        return new ExportDocument(
                workbook(data),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName(data.response(), "xlsx")
        );
    }

    public ExportDocument pdf(
            UUID offeringId,
            LocalDate weekStart,
            ReconciliationView view,
            String query,
            boolean exceptionsOnly
    ) {
        ExportData data = data(offeringId, weekStart, view, query, exceptionsOnly);
        return new ExportDocument(renderPdf(data), "application/pdf", fileName(data.response(), "pdf"));
    }

    private ExportData data(UUID offeringId, LocalDate weekStart, ReconciliationView view, String query, boolean exceptionsOnly) {
        LessonReconciliationResponse first = reconciliationService.reconcile(
                offeringId, weekStart, view, query, exceptionsOnly, 0, EXPORT_PAGE_SIZE
        );
        List<ReconciliationRowResponse> rows = new ArrayList<>(first.rows());
        for (int page = 1; page < first.totalPages(); page++) {
            rows.addAll(reconciliationService.reconcile(
                    offeringId, weekStart, view, query, exceptionsOnly, page, EXPORT_PAGE_SIZE
            ).rows());
        }
        return new ExportData(first, List.copyOf(rows));
    }

    private byte[] workbook(ExportData data) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            entry(zip, "[Content_Types].xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                    </Types>
                    """);
            entry(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                    </Relationships>
                    """);
            entry(zip, "xl/workbook.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                      <sheets><sheet name="Lesson reconciliation" sheetId="1" r:id="rId1"/></sheets>
                    </workbook>
                    """);
            entry(zip, "xl/_rels/workbook.xml.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                    </Relationships>
                    """);
            entry(zip, "xl/styles.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                      <fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts>
                      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF23312E"/><bgColor indexed="64"/></patternFill></fill></fills>
                      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
                      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                      <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
                    </styleSheet>
                    """);
            entry(zip, "xl/worksheets/sheet1.xml", worksheet(data));
            zip.finish();
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("The reconciliation spreadsheet could not be prepared.", exception);
        }
    }

    private String worksheet(ExportData data) {
        List<String> headers = new ArrayList<>(List.of(
                "Student", "Student number", "Payment", "Purchased", "Used", "Remaining", "Make-ups due", "Expiring soon"
        ));
        headers.addAll(data.response().sessions().stream().map(session -> DATE.format(session.date())).toList());
        StringBuilder xml = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" xSplit="2" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
                  <cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/><col min="3" max="8" width="14" customWidth="1"/><col min="9" max="100" width="20" customWidth="1"/></cols>
                  <sheetData>
                """);
        appendRow(xml, 1, headers, true);
        int rowNumber = 2;
        for (ReconciliationRowResponse row : data.rows()) {
            List<String> values = new ArrayList<>(List.of(
                    row.studentName(), row.studentNumber(), payment(row.paymentStatus()),
                    Integer.toString(row.purchasedSessions()), Integer.toString(row.usedSessions()),
                    Integer.toString(row.remainingSessions()), Integer.toString(row.makeupDue()),
                    Integer.toString(row.expiringSessions())
            ));
            values.addAll(row.cells().stream().map(this::cellLabel).toList());
            appendRow(xml, rowNumber++, values, false);
        }
        String lastColumn = columnName(headers.size());
        xml.append("</sheetData><autoFilter ref=\"A1:").append(lastColumn).append(Math.max(1, rowNumber - 1))
                .append("\"/></worksheet>");
        return xml.toString();
    }

    private void appendRow(StringBuilder xml, int rowNumber, List<String> values, boolean header) {
        xml.append("<row r=\"").append(rowNumber).append("\">");
        for (int index = 0; index < values.size(); index++) {
            boolean numeric = !header && index >= 3 && index <= 7;
            xml.append("<c r=\"").append(columnName(index + 1)).append(rowNumber).append("\"");
            if (!numeric) xml.append(" t=\"inlineStr\"");
            if (header) xml.append(" s=\"1\"");
            if (numeric) {
                xml.append("><v>").append(values.get(index)).append("</v></c>");
            } else {
                xml.append("><is><t xml:space=\"preserve\">").append(xml(values.get(index)))
                        .append("</t></is></c>");
            }
        }
        xml.append("</row>");
    }

    private byte[] renderPdf(ExportData data) {
        PDRectangle pageSize = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            int rowIndex = 0;
            do {
                PDPage page = new PDPage(pageSize);
                document.addPage(page);
                try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                    float y = pageSize.getHeight() - 38;
                    text(stream, BOLD, 17, 36, y, "ClassLens lesson reconciliation");
                    y -= 19;
                    LessonReconciliationResponse response = data.response();
                    text(stream, REGULAR, 9, 36, y, response.courseCode() + " | "
                            + DATE.format(response.weekStart()) + " - " + DATE.format(response.weekEnd()));
                    y -= 18;
                    text(stream, REGULAR, 8, 36, y, "Students " + data.rows().size()
                            + "   Payment issues " + response.summary().paymentIssues()
                            + "   Make-ups due " + response.summary().makeupDue()
                            + "   Expiring soon " + response.summary().expiringCredits());
                    y -= 22;
                    List<String> headings = pdfHeadings(response.sessions());
                    pdfRow(stream, headings, y, true, pageSize.getWidth());
                    y -= 24;
                    while (rowIndex < data.rows().size() && y > 52) {
                        pdfRow(stream, pdfValues(data.rows().get(rowIndex)), y, false, pageSize.getWidth());
                        y -= 22;
                        rowIndex++;
                    }
                    text(stream, REGULAR, 7, 36, 28, "Generated from the live payment, attendance and lesson-credit records.");
                }
            } while (rowIndex < data.rows().size() || document.getNumberOfPages() == 0);
            document.save(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("The reconciliation PDF could not be prepared.", exception);
        }
    }

    private List<String> pdfHeadings(List<ReconciliationSessionResponse> sessions) {
        List<String> values = new ArrayList<>(List.of("Student", "Payment", "Paid", "Used", "Left", "Make-up", "Expires"));
        values.addAll(sessions.stream().map(session -> session.date().format(DateTimeFormatter.ofPattern("E d", Locale.ENGLISH))).toList());
        return values;
    }

    private List<String> pdfValues(ReconciliationRowResponse row) {
        List<String> values = new ArrayList<>(List.of(
                row.studentName(), payment(row.paymentStatus()), Integer.toString(row.purchasedSessions()),
                Integer.toString(row.usedSessions()), Integer.toString(row.remainingSessions()),
                Integer.toString(row.makeupDue()), Integer.toString(row.expiringSessions())
        ));
        values.addAll(row.cells().stream().map(this::shortCellLabel).toList());
        return values;
    }

    private void pdfRow(PDPageContentStream stream, List<String> values, float y, boolean header, float pageWidth)
            throws IOException {
        float usable = pageWidth - 72;
        float firstWidth = 126;
        float otherWidth = (usable - firstWidth) / Math.max(1, values.size() - 1);
        float x = 36;
        stream.setNonStrokingColor(
                (header ? 35 : 250) / 255f,
                (header ? 49 : 250) / 255f,
                (header ? 46 : 250) / 255f
        );
        stream.addRect(36, y - 7, usable, 20);
        stream.fill();
        for (int index = 0; index < values.size(); index++) {
            float width = index == 0 ? firstWidth : otherWidth;
            text(stream, header ? BOLD : REGULAR, header ? 7 : 7.5f, x + 4, y,
                    truncate(values.get(index), width - 8, header ? BOLD : REGULAR, header ? 7 : 7.5f), header);
            x += width;
        }
    }

    private void text(PDPageContentStream stream, PDFont font, float size, float x, float y, String value)
            throws IOException {
        text(stream, font, size, x, y, value, false);
    }

    private void text(PDPageContentStream stream, PDFont font, float size, float x, float y, String value, boolean light)
            throws IOException {
        stream.beginText();
        stream.setFont(font, size);
        stream.setNonStrokingColor(
                (light ? 255 : 28) / 255f,
                (light ? 255 : 35) / 255f,
                (light ? 255 : 33) / 255f
        );
        stream.newLineAtOffset(x, y);
        stream.showText(safe(value));
        stream.endText();
    }

    private String truncate(String value, float width, PDFont font, float size) throws IOException {
        String safe = safe(value);
        if (font.getStringWidth(safe) / 1000 * size <= width) return safe;
        String suffix = "...";
        while (!safe.isEmpty() && font.getStringWidth(safe + suffix) / 1000 * size > width) {
            safe = safe.substring(0, safe.length() - 1);
        }
        return safe + suffix;
    }

    private String cellLabel(ReconciliationCellResponse cell) {
        if (cell.uncoveredAttendance()) return "Attendance without paid lesson";
        if (cell.attendanceStatus() == AttendanceStatus.PRESENT) return "Present";
        if (cell.attendanceStatus() == AttendanceStatus.LATE) return "Late";
        if (cell.attendanceStatus() == AttendanceStatus.ABSENT) {
            return cell.creditStatus() == null ? "Absent" : "Absent / " + words(cell.creditStatus().name());
        }
        if (cell.creditStatus() != null) return words(cell.creditStatus().name());
        return "Not recorded";
    }

    private String shortCellLabel(ReconciliationCellResponse cell) {
        if (cell.uncoveredAttendance()) return "Unpaid";
        return switch (cell.attendanceStatus()) {
            case PRESENT -> "Present";
            case LATE -> "Late";
            case ABSENT -> "Absent";
            case UNKNOWN -> cell.creditStatus() == null ? "-" : words(cell.creditStatus().name());
        };
    }

    private String payment(InvoiceStatus status) {
        return status == null ? "No payment" : words(status.name());
    }

    private String words(String value) {
        String lower = value.replace('_', ' ').toLowerCase(Locale.ENGLISH);
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private String fileName(LessonReconciliationResponse response, String extension) {
        return "lesson-reconciliation-" + response.courseCode().replaceAll("[^A-Za-z0-9_-]", "-")
                + "-" + response.weekStart() + "." + extension;
    }

    private String columnName(int column) {
        StringBuilder value = new StringBuilder();
        int current = column;
        while (current > 0) {
            current--;
            value.insert(0, (char) ('A' + (current % 26)));
            current /= 26;
        }
        return value.toString();
    }

    private String xml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private String safe(String value) {
        if (value == null) return "";
        return value.replaceAll("[^\\x20-\\x7E]", "?");
    }

    private void entry(ZipOutputStream zip, String name, String value) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(value.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private record ExportData(LessonReconciliationResponse response, List<ReconciliationRowResponse> rows) {
    }

    public record ExportDocument(byte[] content, String contentType, String fileName) {
    }
}
