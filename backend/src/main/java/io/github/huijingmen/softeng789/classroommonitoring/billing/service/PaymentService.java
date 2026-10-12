package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoicesResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CreateStudentInvoiceBatchRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CreateStudentInvoiceBatchResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.StudentInvoiceDraftRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentProvider;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentResponseMapper.toStatement;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class PaymentService {
    private final StudentInvoiceRepository invoiceRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentProvider paymentProvider;
    private final PaymentLedgerService ledgerService;
    private final ManualPaymentService manualPaymentService;
    private final SessionPackageService sessionPackageService;
    private final LearningEntitlementService entitlementService;
    private final InvoiceDraftFactory invoiceDraftFactory;
    private final AdminPaymentQueryService adminPaymentQueryService;

    public PaymentService(
            StudentInvoiceRepository invoiceRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            PaymentProvider paymentProvider,
            PaymentLedgerService ledgerService,
            ManualPaymentService manualPaymentService,
            SessionPackageService sessionPackageService,
            LearningEntitlementService entitlementService,
            InvoiceDraftFactory invoiceDraftFactory,
            AdminPaymentQueryService adminPaymentQueryService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.paymentProvider = paymentProvider;
        this.ledgerService = ledgerService;
        this.manualPaymentService = manualPaymentService;
        this.sessionPackageService = sessionPackageService;
        this.entitlementService = entitlementService;
        this.invoiceDraftFactory = invoiceDraftFactory;
        this.adminPaymentQueryService = adminPaymentQueryService;
    }

    @Transactional
    public StudentStatementResponse statement(UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        List<StudentInvoice> invoices = invoiceRepository.findStatementByStudentId(studentId);
        refreshOverdue(invoices);
        var packagesByInvoice = sessionPackageService.summarizeAllForInvoices(
                        invoices.stream().map(StudentInvoice::getId).toList()
                );
        return toStatement(
                student,
                invoices,
                InvoiceDraftFactory.CURRENCY,
                manualPaymentService.currentBankAccountOrNull(),
                manualPaymentService.submissionsByInvoiceForStudent(studentId),
                packagesByInvoice
        );
    }

    @Transactional
    public CheckoutResponse checkout(UUID studentId, UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findForStudentForUpdate(invoiceId, studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        refreshOverdue(List.of(invoice));
        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "This payment request was cancelled.");
        }
        BigDecimal balance = balance(invoice);
        if (balance.signum() <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "This payment request is already paid.");
        }

        PaymentProvider.PaymentReceipt receipt = paymentProvider.collect(invoiceId, balance, invoice.getCurrency());
        ledgerService.recordSuccessfulPayment(
                invoice, balance, receipt.provider(), receipt.reference(), receipt.occurredAt()
        );
        StudentInvoice saved = invoiceRepository.save(invoice);
        entitlementService.activateForInvoice(saved);
        sessionPackageService.activateForInvoice(saved);
        var usage = sessionPackageService.summarizeAllForInvoices(List.of(saved.getId()))
                .getOrDefault(saved.getId(), List.of());
        return new CheckoutResponse(
                PaymentResponseMapper.toInvoice(saved, List.of(), usage),
                "Demo payment recorded successfully.",
                true
        );
    }

    @Transactional
    public CreateInvoicesResponse create(UUID adminId, CreateInvoiceRequest request) {
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        List<CoursePurchaseRequest> purchases = request.purchases();
        invoiceDraftFactory.validate(
                request.lineItems(),
                purchases,
                "Add between 1 and 20 invoice items.",
                "Charges must be greater than credits."
        );
        List<Student> students = studentRepository.findAllById(request.studentIds());
        if (students.size() != request.studentIds().stream().distinct().count()) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more students could not be found.");
        }

        List<StudentInvoice> invoices = students.stream()
                .map(student -> invoiceDraftFactory.create(
                        admin,
                        student,
                        request.title(),
                        request.note(),
                        request.dueDate(),
                        purchases,
                        request.lineItems()
                ))
                .toList();
        List<StudentInvoice> saved = invoiceRepository.saveAll(invoices);
        for (int index = 0; index < purchases.size(); index++) {
            var purchase = purchases.get(index);
            var entitlements = entitlementService.createForInvoices(saved, purchase.entitlement(), index);
            sessionPackageService.createForInvoices(saved, purchase.entitlement(), entitlements);
        }
        if (purchases.isEmpty() && request.entitlement() != null) {
            var entitlements = entitlementService.createForInvoices(saved, request.entitlement(), 0);
            sessionPackageService.createForInvoices(saved, request.entitlement(), entitlements);
        }
        var packagesByInvoice = sessionPackageService.summarizeAllForInvoices(
                saved.stream().map(StudentInvoice::getId).toList()
        );
        return new CreateInvoicesResponse(saved.stream()
                .map(invoice -> PaymentResponseMapper.toInvoice(
                        invoice, List.of(), packagesByInvoice.getOrDefault(invoice.getId(), List.of())
                ))
                .toList());
    }

    @Transactional
    public CreateStudentInvoiceBatchResponse createStudentBatch(
            UUID adminId,
            CreateStudentInvoiceBatchRequest request
    ) {
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        List<UUID> studentIds = request.invoices().stream().map(StudentInvoiceDraftRequest::studentId).toList();
        if (studentIds.stream().distinct().count() != studentIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "Create only one invoice per student in a batch.");
        }
        Map<UUID, Student> students = new LinkedHashMap<>();
        studentRepository.findAllById(studentIds).forEach(student -> students.put(student.getId(), student));
        if (students.size() != studentIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more students could not be found.");
        }

        List<StudentInvoice> saved = new java.util.ArrayList<>();
        for (StudentInvoiceDraftRequest draft : request.invoices()) {
            invoiceDraftFactory.validate(
                    draft.lineItems(),
                    draft.coursePurchases(),
                    "Each student invoice must contain between 1 and 20 items.",
                    "Each student invoice must have charges greater than credits."
            );
            StudentInvoice invoice = invoiceDraftFactory.create(
                    admin,
                    students.get(draft.studentId()),
                    draft.title(),
                    draft.note(),
                    draft.dueDate(),
                    draft.coursePurchases(),
                    draft.lineItems()
            );
            StudentInvoice persisted = invoiceRepository.save(invoice);
            for (int index = 0; index < draft.coursePurchases().size(); index++) {
                CoursePurchaseRequest purchase = draft.coursePurchases().get(index);
                var entitlements = entitlementService.createForInvoices(
                        List.of(persisted), purchase.entitlement(), index
                );
                sessionPackageService.createForInvoices(List.of(persisted), purchase.entitlement(), entitlements);
            }
            saved.add(persisted);
        }
        var packagesByInvoice = sessionPackageService.summarizeAllForInvoices(
                saved.stream().map(StudentInvoice::getId).toList()
        );
        return new CreateStudentInvoiceBatchResponse(saved.stream()
                .map(invoice -> PaymentResponseMapper.toInvoice(
                        invoice, List.of(), packagesByInvoice.getOrDefault(invoice.getId(), List.of())
                ))
                .toList());
    }

    @Transactional
    public AdminPaymentsResponse adminList(String query, InvoiceStatus status, int page, int size) {
        return adminPaymentQueryService.list(query, status, page, size);
    }

    @Transactional
    public InvoiceResponse adminInvoice(UUID invoiceId) {
        return adminPaymentQueryService.invoice(invoiceId);
    }

    private void refreshOverdue(List<StudentInvoice> invoices) {
        boolean changed = false;
        for (StudentInvoice invoice : invoices) {
            if (invoice.getStatus().canBecomeOverdue() && invoice.getDueDate().isBefore(BillingDates.today())) {
                invoice.setStatus(InvoiceStatus.OVERDUE);
                changed = true;
            }
        }
        if (changed) invoiceRepository.saveAll(invoices);
    }

}
