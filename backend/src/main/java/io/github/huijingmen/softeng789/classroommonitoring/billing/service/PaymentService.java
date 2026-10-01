package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoicesResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentProvider;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.InvoiceLineItemRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.PaymentTransactionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentResponseMapper.toInvoice;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentResponseMapper.toStatement;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class PaymentService {
    private static final String CURRENCY = "NZD";
    private static final int MAX_PAGE_SIZE = 100;
    private static final EnumSet<InvoiceStatus> OPEN_STATUSES = EnumSet.of(
            InvoiceStatus.PENDING,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE
    );

    private final StudentInvoiceRepository invoiceRepository;
    private final InvoiceLineItemRepository lineItemRepository;
    private final PaymentTransactionRepository transactionRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentProvider paymentProvider;
    private final PaymentLedgerService ledgerService;
    private final BankTransferService bankTransferService;

    public PaymentService(
            StudentInvoiceRepository invoiceRepository,
            InvoiceLineItemRepository lineItemRepository,
            PaymentTransactionRepository transactionRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            PaymentProvider paymentProvider,
            PaymentLedgerService ledgerService,
            BankTransferService bankTransferService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.lineItemRepository = lineItemRepository;
        this.transactionRepository = transactionRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.paymentProvider = paymentProvider;
        this.ledgerService = ledgerService;
        this.bankTransferService = bankTransferService;
    }

    @Transactional
    public StudentStatementResponse statement(UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        List<StudentInvoice> invoices = invoiceRepository.findStatementByStudentId(studentId);
        refreshOverdue(invoices);
        return toStatement(
                student,
                invoices,
                CURRENCY,
                bankTransferService.currentBankAccountOrNull(),
                bankTransferService.transfersByInvoiceForStudent(studentId)
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
        return new CheckoutResponse(toInvoice(saved), "Demo payment recorded successfully.", true);
    }

    @Transactional
    public CreateInvoicesResponse create(UUID adminId, CreateInvoiceRequest request) {
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        BigDecimal netTotal = netTotal(request.lineItems());
        if (netTotal.signum() <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Charges must be greater than credits.");
        }
        List<Student> students = studentRepository.findAllById(request.studentIds());
        if (students.size() != request.studentIds().stream().distinct().count()) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more students could not be found.");
        }

        List<StudentInvoice> invoices = students.stream().map(student -> {
            StudentInvoice invoice = new StudentInvoice();
            invoice.setStudent(student);
            invoice.setCreatedByAdmin(admin);
            invoice.setTitle(request.title().trim());
            invoice.setNote(cleanOptional(request.note()));
            invoice.setDueDate(request.dueDate());
            invoice.setCurrency(CURRENCY);
            invoice.setStatus(request.dueDate().isBefore(LocalDate.now())
                    ? InvoiceStatus.OVERDUE
                    : InvoiceStatus.PENDING);
            for (int index = 0; index < request.lineItems().size(); index++) {
                LineItemRequest source = request.lineItems().get(index);
                InvoiceLineItem item = new InvoiceLineItem();
                item.setDescription(source.description().trim());
                item.setType(source.type());
                item.setAmount(money(source.amount()));
                item.setPosition(index);
                invoice.addLineItem(item);
            }
            return invoice;
        }).toList();
        return new CreateInvoicesResponse(invoiceRepository.saveAll(invoices).stream().map(PaymentResponseMapper::toInvoice).toList());
    }

    @Transactional
    public AdminPaymentsResponse adminList(String query, InvoiceStatus status, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid payment page request.");
        }
        invoiceRepository.markOverdue(
                EnumSet.of(InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID),
                InvoiceStatus.OVERDUE,
                LocalDate.now()
        );

        PageRequest pageable = PageRequest.of(page, size, Sort.by(
                Sort.Order.asc("dueDate"),
                Sort.Order.desc("createdAt")
        ));
        Page<StudentInvoice> result = invoiceRepository.search(query == null ? "" : query.trim(), status, pageable);
        PageResponse<AdminPaymentRowResponse> responsePage =
                PageResponse.from(result, PaymentResponseMapper::toAdminRow);
        return new AdminPaymentsResponse(summary(), responsePage);
    }

    private AdminPaymentSummaryResponse summary() {
        BigDecimal charges = lineItemRepository.sumAmountByTypeAndInvoiceStatusIn(
                LineItemType.CHARGE,
                OPEN_STATUSES
        );
        BigDecimal credits = lineItemRepository.sumAmountByTypeAndInvoiceStatusIn(
                LineItemType.CREDIT,
                OPEN_STATUSES
        );
        BigDecimal openPayments = transactionRepository.sumAmountByStatusAndInvoiceStatusIn(
                PaymentStatus.SUCCEEDED,
                OPEN_STATUSES
        );
        BigDecimal outstanding = charges.subtract(credits).subtract(openPayments).max(BigDecimal.ZERO);
        BigDecimal collected = transactionRepository.sumAmountByStatus(PaymentStatus.SUCCEEDED);
        long overdueCount = invoiceRepository.countByStatus(InvoiceStatus.OVERDUE);
        long openCount = invoiceRepository.countByStatusIn(OPEN_STATUSES);
        return new AdminPaymentSummaryResponse(money(outstanding), money(collected), overdueCount, openCount, CURRENCY);
    }

    private void refreshOverdue(List<StudentInvoice> invoices) {
        boolean changed = false;
        for (StudentInvoice invoice : invoices) {
            if (invoice.getStatus().canBecomeOverdue() && invoice.getDueDate().isBefore(LocalDate.now())) {
                invoice.setStatus(InvoiceStatus.OVERDUE);
                changed = true;
            }
        }
        if (changed) invoiceRepository.saveAll(invoices);
    }

    private BigDecimal netTotal(List<LineItemRequest> items) {
        return items.stream().map(item -> item.type() == LineItemType.CREDIT
                ? item.amount().negate()
                : item.amount()).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
