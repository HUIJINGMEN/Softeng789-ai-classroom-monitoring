package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/**
 * Builds valid draft invoice aggregates without persistence side effects.
 *
 * <p>Keeping construction rules here prevents the single-student and batch workflows from
 * gradually acquiring different validation, numbering or line-item ordering behaviour.</p>
 */
@Component
public class InvoiceDraftFactory {
    static final String CURRENCY = "NZD";
    private static final int MIN_ITEMS = 1;
    private static final int MAX_ITEMS = 20;

    public void validate(
            List<LineItemRequest> lineItems,
            List<CoursePurchaseRequest> purchases,
            String itemCountMessage,
            String totalMessage
    ) {
        int itemCount = lineItems.size() + purchases.size();
        if (itemCount < MIN_ITEMS || itemCount > MAX_ITEMS) {
            throw new ResponseStatusException(BAD_REQUEST, itemCountMessage);
        }
        if (netTotal(lineItems, purchases).signum() <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, totalMessage);
        }
    }

    public StudentInvoice create(
            Teacher admin,
            Student student,
            String title,
            String note,
            LocalDate dueDate,
            List<CoursePurchaseRequest> purchases,
            List<LineItemRequest> lineItems
    ) {
        StudentInvoice invoice = new StudentInvoice();
        invoice.setStudent(student);
        invoice.setCreatedByAdmin(admin);
        invoice.setInvoiceNumber(nextInvoiceNumber());
        invoice.setTitle(title.trim());
        invoice.setNote(cleanOptional(note));
        invoice.setDueDate(dueDate);
        invoice.setCurrency(CURRENCY);
        invoice.setStatus(InvoiceStatus.DRAFT);

        int position = 0;
        for (CoursePurchaseRequest purchase : purchases) {
            invoice.addLineItem(lineItem(
                    purchase.description(),
                    LineItemType.CHARGE,
                    purchase.amount(),
                    position++
            ));
        }
        for (LineItemRequest source : lineItems) {
            invoice.addLineItem(lineItem(
                    source.description(),
                    source.type(),
                    source.amount(),
                    position++
            ));
        }
        return invoice;
    }

    private InvoiceLineItem lineItem(String description, LineItemType type, BigDecimal amount, int position) {
        InvoiceLineItem item = new InvoiceLineItem();
        item.setDescription(description.trim());
        item.setType(type);
        item.setAmount(money(amount));
        item.setPosition(position);
        return item;
    }

    private BigDecimal netTotal(
            List<LineItemRequest> lineItems,
            List<CoursePurchaseRequest> purchases
    ) {
        BigDecimal additionalItems = lineItems.stream()
                .map(item -> item.type() == LineItemType.CREDIT ? item.amount().negate() : item.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal coursePurchases = purchases.stream()
                .map(CoursePurchaseRequest::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return additionalItems.add(coursePurchases);
    }

    private String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String nextInvoiceNumber() {
        String token = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CL-" + BillingDates.currentYear() + "-" + token;
    }
}
