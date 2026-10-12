package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountActivityType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountAdjustmentType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountAdjustmentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.InvoiceAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.ManageSessionPackageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsDashboardResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.SessionPackageOperationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Stable application facade for invoice-account use cases.
 *
 * <p>Specialised services own read models, package lifecycle rules, audit history and operations
 * reporting. Keeping the facade small preserves the existing controller API without centralising
 * every billing responsibility in one class.</p>
 */
@Service
public class BillingAccountService {
    private final StudentInvoiceRepository invoiceRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentLedgerService paymentLedgerService;
    private final BillingAccountActivityService activityService;
    private final BillingAccountQueryService queryService;
    private final SessionPackageLifecycleService packageLifecycleService;
    private final BillingOperationsService operationsService;

    public BillingAccountService(
            StudentInvoiceRepository invoiceRepository,
            TeacherRepository teacherRepository,
            PaymentLedgerService paymentLedgerService,
            BillingAccountActivityService activityService,
            BillingAccountQueryService queryService,
            SessionPackageLifecycleService packageLifecycleService,
            BillingOperationsService operationsService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.teacherRepository = teacherRepository;
        this.paymentLedgerService = paymentLedgerService;
        this.activityService = activityService;
        this.queryService = queryService;
        this.packageLifecycleService = packageLifecycleService;
        this.operationsService = operationsService;
    }

    // Building a lesson-package snapshot first reconciles credits against the latest
    // session and attendance state, so this transaction may legitimately persist
    // lifecycle transitions and acquire the account lock.
    @Transactional
    public InvoiceAccountResponse account(UUID invoiceId) {
        return queryService.response(requireInvoice(invoiceId));
    }

    @Transactional
    public InvoiceAccountResponse adjust(UUID adminId, UUID invoiceId, AccountAdjustmentRequest request) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        Teacher admin = requireAdmin(adminId);
        BigDecimal amount = money(request.amount());
        BigDecimal paid = payments(invoice);
        BigDecimal netCharges = money(InvoiceAmounts.charges(invoice).subtract(InvoiceAmounts.credits(invoice)));
        String reason = request.reason().trim();
        String externalReference = cleanOptional(request.externalReference());
        validateAdjustment(invoice, request.type(), amount, paid, netCharges, externalReference);

        if (request.type() == AccountAdjustmentType.CREDIT || request.type() == AccountAdjustmentType.REFUND) {
            addCreditLine(invoice, request.type(), amount, reason);
        }
        if (request.type() == AccountAdjustmentType.REFUND
                || request.type() == AccountAdjustmentType.PAYMENT_REVERSAL) {
            recordPaymentReduction(invoice, request.type(), amount, externalReference);
        } else {
            paymentLedgerService.refreshStatus(invoice);
        }

        invoiceRepository.save(invoice);
        activityService.record(
                invoice.getStudent(), invoice, null, activityType(request.type()), amount,
                null, null, reason, admin, externalReference
        );
        return queryService.response(invoice);
    }

    public SessionPackageOperationResponse managePackage(
            UUID adminId,
            UUID packageId,
            ManageSessionPackageRequest request
    ) {
        return packageLifecycleService.manage(adminId, packageId, request);
    }

    public OperationsDashboardResponse operationsDashboard() {
        return operationsService.dashboard();
    }

    public OperationsDashboardResponse operationsDashboard(LocalDate from, LocalDate to) {
        return operationsService.dashboard(from, to);
    }

    private void validateAdjustment(
            StudentInvoice invoice,
            AccountAdjustmentType type,
            BigDecimal amount,
            BigDecimal paid,
            BigDecimal netCharges,
            String externalReference
    ) {
        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "A cancelled payment request cannot be adjusted.");
        }
        if (type == AccountAdjustmentType.CREDIT && amount.compareTo(netCharges) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Credit cannot exceed the remaining invoiced charges.");
        }
        if ((type == AccountAdjustmentType.REFUND || type == AccountAdjustmentType.PAYMENT_REVERSAL)
                && amount.compareTo(paid) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Amount cannot exceed the payment available to reverse.");
        }
        if (type == AccountAdjustmentType.REFUND && amount.compareTo(netCharges) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Refund cannot exceed the remaining invoiced charges.");
        }
        if (type == AccountAdjustmentType.REFUND && externalReference == null) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    "Enter the bank or payment-provider reference for the refund already completed outside ClassLens."
            );
        }
    }

    private void addCreditLine(
            StudentInvoice invoice,
            AccountAdjustmentType type,
            BigDecimal amount,
            String reason
    ) {
        InvoiceLineItem credit = new InvoiceLineItem();
        credit.setDescription((type == AccountAdjustmentType.REFUND ? "Refund" : "Account credit") + " — " + reason);
        credit.setType(LineItemType.CREDIT);
        credit.setAmount(amount);
        credit.setPosition(invoice.getLineItems().size());
        invoice.addLineItem(credit);
    }

    private void recordPaymentReduction(
            StudentInvoice invoice,
            AccountAdjustmentType type,
            BigDecimal amount,
            String externalReference
    ) {
        boolean externalRefund = type == AccountAdjustmentType.REFUND;
        paymentLedgerService.recordRefund(
                invoice,
                amount,
                externalRefund ? "EXTERNAL_REFUND" : "ADMIN_CORRECTION",
                externalRefund
                        ? "EXTERNAL-REFUND-" + externalReference
                        : "ADMIN-CORRECTION-" + UUID.randomUUID(),
                Instant.now()
        );
    }

    private AccountActivityType activityType(AccountAdjustmentType type) {
        return switch (type) {
            case CREDIT -> AccountActivityType.CREDIT_ADJUSTMENT;
            case REFUND -> AccountActivityType.REFUND_ISSUED;
            case PAYMENT_REVERSAL -> AccountActivityType.PAYMENT_REVERSED;
        };
    }

    private StudentInvoice requireInvoice(UUID invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
    }

    private Teacher requireAdmin(UUID adminId) {
        return teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
    }

    private String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
