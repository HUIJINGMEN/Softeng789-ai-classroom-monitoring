package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

/** Renders an invoice snapshot without database or delivery concerns. */
@Component
public class InvoicePdfRenderer {
    private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final PDRectangle PAGE = PDRectangle.A4;
    private static final float MARGIN = 54;
    private static final float CONTENT_WIDTH = PAGE.getWidth() - (MARGIN * 2);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH);

    public byte[] render(InvoiceDocument invoice) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            renderInvoice(document, invoice);
            document.save(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("The invoice PDF could not be prepared.", exception);
        }
    }

    private void renderInvoice(PDDocument document, InvoiceDocument invoice) throws IOException {
        Canvas canvas = new Canvas(document);
        canvas.brand("ClassLens", "Student account invoice");
        canvas.rightMeta("INVOICE", invoice.invoiceNumber(), 22);
        canvas.space(58);
        canvas.heading(invoice.title(), 22);
        canvas.space(12);
        canvas.rule();
        canvas.space(18);

        float metaTop = canvas.y();
        canvas.label("BILL TO");
        canvas.text(invoice.studentName(), BOLD, 11);
        canvas.text(invoice.studentNumber(), REGULAR, 10);
        canvas.text(invoice.studentEmail(), REGULAR, 10);
        canvas.setY(metaTop);
        canvas.rightPair("Issued", DATE.format(invoice.issuedDate()));
        canvas.rightPair("Due", DATE.format(invoice.dueDate()));
        canvas.rightPair("Currency", invoice.currency());
        canvas.setY(Math.min(canvas.y(), metaTop - 64));
        canvas.space(24);

        canvas.tableHeader("Description", "Amount");
        for (InvoiceDocument.Item item : invoice.items()) {
            String prefix = item.type() == LineItemType.CREDIT ? "Credit · " : "";
            canvas.tableRow(prefix + item.description(), signedMoney(item.amount(), item.type(), invoice.currency()));
        }
        canvas.space(14);
        canvas.totals(invoice);

        if (!invoice.coursePurchases().isEmpty()) {
            for (var purchase : invoice.coursePurchases()) {
                canvas.space(24);
                canvas.rule();
                canvas.space(18);
                if (purchase.sessionPackage() != null) {
                    var sessionPackage = purchase.sessionPackage();
                    canvas.heading("Session package", 15);
                    canvas.text(sessionPackage.courseCode() + " · " + sessionPackage.academicTerm(), REGULAR, 10);
                    canvas.space(8);
                    canvas.statLine("Sessions purchased", sessionPackage.purchasedSessions());
                    canvas.statLine("Attended", sessionPackage.attendedSessions());
                    canvas.statLine("Chargeable absences", sessionPackage.chargeableAbsences());
                    canvas.statLine("Remaining", sessionPackage.remainingSessions());
                } else {
                    var entitlement = purchase.entitlement();
                    canvas.heading(purchaseTitle(entitlement.purchaseMode()), 15);
                    canvas.text(entitlement.courseCode() + " · " + entitlement.academicTerm(), REGULAR, 10);
                    canvas.space(8);
                    canvas.detailLine("Access status", friendlyName(entitlement.status().name()));
                    canvas.detailLine("Coverage", coverage(entitlement));
                    if (entitlement.sessionAllowance() != null) {
                        canvas.detailLine("Lessons included", Integer.toString(entitlement.sessionAllowance()));
                    }
                }
            }
        } else if (invoice.sessionPackage() != null) {
            canvas.space(24);
            canvas.rule();
            canvas.space(18);
            canvas.heading("Session package", 15);
            canvas.text(
                    invoice.sessionPackage().courseCode() + " · " + invoice.sessionPackage().academicTerm(),
                    REGULAR,
                    10
            );
            canvas.space(8);
            canvas.statLine("Sessions purchased", invoice.sessionPackage().purchasedSessions());
            canvas.statLine("Attended", invoice.sessionPackage().attendedSessions());
            canvas.statLine("Chargeable absences", invoice.sessionPackage().chargeableAbsences());
            canvas.statLine("Remaining", invoice.sessionPackage().remainingSessions());
        } else if (invoice.entitlement() != null) {
            canvas.space(24);
            canvas.rule();
            canvas.space(18);
            canvas.heading(purchaseTitle(invoice.entitlement().purchaseMode()), 15);
            canvas.text(invoice.entitlement().courseCode() + " · " + invoice.entitlement().academicTerm(), REGULAR, 10);
            canvas.space(8);
            canvas.detailLine("Access status", friendlyName(invoice.entitlement().status().name()));
            canvas.detailLine("Coverage", coverage(invoice.entitlement()));
            if (invoice.entitlement().sessionAllowance() != null) {
                canvas.detailLine("Lessons included", Integer.toString(invoice.entitlement().sessionAllowance()));
            }
        }

        if (invoice.note() != null && !invoice.note().isBlank()) {
            canvas.space(24);
            canvas.rule();
            canvas.space(18);
            canvas.heading("A note for you", 15);
            canvas.paragraph(invoice.note(), 10, 14);
        }

        canvas.footer("This invoice is also available in your ClassLens student account.");
        canvas.close();
    }

    private static String signedMoney(BigDecimal amount, LineItemType type, String currency) {
        String sign = type == LineItemType.CREDIT ? "−" : "";
        return sign + money(amount, currency);
    }

    private static String money(BigDecimal amount, String currency) {
        NumberFormat format = NumberFormat.getCurrencyInstance(Locale.of("en", "NZ"));
        return format.format(amount) + " " + currency;
    }

    private static String purchaseTitle(io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode mode) {
        return switch (mode) {
            case COURSE_ENROLMENT -> "Full course enrolment";
            case LESSON_PACKAGE -> "Lesson package";
            case MEMBERSHIP -> "Membership access";
            case PAY_PER_LESSON -> "Single lesson";
        };
    }

    private static String coverage(io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementResponse entitlement) {
        if (entitlement.classroomSessionDate() != null) return DATE.format(entitlement.classroomSessionDate());
        if (entitlement.validFrom() != null && entitlement.validTo() != null) {
            if (entitlement.validFrom().equals(entitlement.validTo())) return DATE.format(entitlement.validFrom());
            return DATE.format(entitlement.validFrom()) + " - " + DATE.format(entitlement.validTo());
        }
        return "Follows the class timetable";
    }

    private static String friendlyName(String value) {
        String lower = value.toLowerCase(Locale.ENGLISH).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static final class Canvas {
        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream stream;
        private float y;

        private Canvas(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private void newPage() throws IOException {
            if (stream != null) stream.close();
            page = new PDPage(PAGE);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            stream.setNonStrokingColor(1f, 1f, 1f);
            stream.addRect(0, 0, PAGE.getWidth(), PAGE.getHeight());
            stream.fill();
            y = PAGE.getHeight() - MARGIN;
        }

        private void ensure(float required) throws IOException {
            if (y - required < 70) newPage();
        }

        private void brand(String name, String descriptor) throws IOException {
            textAt(name, MARGIN, y, BOLD, 17);
            textAt(descriptor, MARGIN, y - 17, REGULAR, 9);
        }

        private void rightMeta(String label, String value, float valueSize) throws IOException {
            rightText(label, y, BOLD, 8);
            rightText(value, y - 25, BOLD, valueSize);
        }

        private void heading(String value, float size) throws IOException {
            ensure(size + 8);
            text(value, BOLD, size);
        }

        private void label(String value) throws IOException {
            text(value, BOLD, 8);
            space(5);
        }

        private void text(String value, PDFont font, float size) throws IOException {
            ensure(size + 5);
            textAt(value, MARGIN, y, font, size);
            y -= size + 5;
        }

        private void paragraph(String value, float size, float leading) throws IOException {
            for (String line : wrap(value, REGULAR, size, CONTENT_WIDTH)) {
                ensure(leading);
                textAt(line, MARGIN, y, REGULAR, size);
                y -= leading;
            }
        }

        private void rule() throws IOException {
            stream.setStrokingColor(204 / 255f, 210 / 255f, 208 / 255f);
            stream.setLineWidth(0.7f);
            stream.moveTo(MARGIN, y);
            stream.lineTo(PAGE.getWidth() - MARGIN, y);
            stream.stroke();
        }

        private void tableHeader(String left, String right) throws IOException {
            ensure(26);
            textAt(left.toUpperCase(Locale.ENGLISH), MARGIN, y, BOLD, 8);
            rightText(right.toUpperCase(Locale.ENGLISH), y, BOLD, 8);
            y -= 13;
            rule();
            y -= 15;
        }

        private void tableRow(String description, String amount) throws IOException {
            ensure(30);
            List<String> lines = wrap(description, REGULAR, 10, CONTENT_WIDTH - 165);
            float rowTop = y;
            for (String line : lines) {
                textAt(line, MARGIN, y, REGULAR, 10);
                y -= 14;
            }
            rightText(amount, rowTop, BOLD, 10);
            y -= 7;
            rule();
            y -= 12;
        }

        private void totals(InvoiceDocument invoice) throws IOException {
            totalLine("Charges", money(invoice.charges(), invoice.currency()), false);
            totalLine("Credits", "−" + money(invoice.credits(), invoice.currency()), false);
            totalLine("Payments received", "−" + money(invoice.payments(), invoice.currency()), false);
            space(4);
            totalLine("Amount due", money(invoice.balance(), invoice.currency()), true);
        }

        private void totalLine(String label, String value, boolean emphasis) throws IOException {
            ensure(24);
            float x = PAGE.getWidth() - MARGIN - 220;
            textAt(label, x, y, emphasis ? BOLD : REGULAR, emphasis ? 12 : 10);
            rightText(value, y, BOLD, emphasis ? 14 : 10);
            y -= emphasis ? 22 : 17;
        }

        private void statLine(String label, int value) throws IOException {
            ensure(18);
            textAt(label, MARGIN, y, REGULAR, 10);
            textAt(Integer.toString(value), MARGIN + 180, y, BOLD, 10);
            y -= 17;
        }

        private void detailLine(String label, String value) throws IOException {
            ensure(18);
            textAt(label, MARGIN, y, REGULAR, 10);
            textAt(value, MARGIN + 180, y, BOLD, 10);
            y -= 17;
        }

        private void rightPair(String label, String value) throws IOException {
            float x = PAGE.getWidth() - MARGIN - 170;
            textAt(label, x, y, REGULAR, 9);
            rightText(value, y, BOLD, 9);
            y -= 16;
        }

        private void footer(String value) throws IOException {
            textAt(value, MARGIN, 38, REGULAR, 8);
            rightText("ClassLens", 38, BOLD, 8);
        }

        private void rightText(String value, float baseline, PDFont font, float size) throws IOException {
            String safeValue = safePdfText(value, font);
            float width = font.getStringWidth(safeValue) / 1000 * size;
            textAt(safeValue, PAGE.getWidth() - MARGIN - width, baseline, font, size);
        }

        private void textAt(String value, float x, float baseline, PDFont font, float size) throws IOException {
            stream.beginText();
            stream.setFont(font, size);
            stream.setNonStrokingColor(25 / 255f, 31 / 255f, 30 / 255f);
            stream.newLineAtOffset(x, baseline);
            stream.showText(safePdfText(value, font));
            stream.endText();
        }

        private void space(float amount) {
            y -= amount;
        }

        private float y() {
            return y;
        }

        private void setY(float value) {
            y = value;
        }

        private void close() throws IOException {
            stream.close();
        }
    }

    private static List<String> wrap(String text, PDFont font, float size, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : text.replace('\n', ' ').trim().split("\\s+")) {
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (!current.isEmpty() && font.getStringWidth(safePdfText(candidate, font)) / 1000 * size > maxWidth) {
                lines.add(current.toString());
                current = new StringBuilder(word);
            } else {
                current = new StringBuilder(candidate);
            }
        }
        if (!current.isEmpty()) lines.add(current.toString());
        return lines.isEmpty() ? List.of("") : lines;
    }

    /** Standard PDF fonts are compact but not Unicode. Replace unsupported glyphs instead of failing export. */
    private static String safePdfText(String value, PDFont font) throws IOException {
        String normalized = value.replace("—", "-").replace("–", "-").replace("−", "-");
        StringBuilder safe = new StringBuilder(normalized.length());
        for (int index = 0; index < normalized.length();) {
            int codePoint = normalized.codePointAt(index);
            String glyph = new String(Character.toChars(codePoint));
            try {
                font.encode(glyph);
                safe.append(glyph);
            } catch (IllegalArgumentException exception) {
                safe.append('?');
            }
            index += Character.charCount(codePoint);
        }
        return safe.toString();
    }
}
