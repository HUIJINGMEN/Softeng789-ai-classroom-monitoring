package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentBankAccount;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminManualPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ManualPaymentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewManualPaymentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateBankAccountRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.ManualPaymentSubmissionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.PaymentBankAccountRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ManualPaymentService {
    private static final int MAX_PAGE_SIZE = 100;

    private final PaymentBankAccountRepository accountRepository;
    private final ManualPaymentSubmissionRepository submissionRepository;
    private final StudentInvoiceRepository invoiceRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentLedgerService ledgerService;
    private final SessionPackageService sessionPackageService;
    private final LearningEntitlementService entitlementService;
    private final PaymentEvidenceStorage evidenceStorage;

    public ManualPaymentService(
            PaymentBankAccountRepository accountRepository,
            ManualPaymentSubmissionRepository submissionRepository,
            StudentInvoiceRepository invoiceRepository,
            TeacherRepository teacherRepository,
            PaymentLedgerService ledgerService,
            SessionPackageService sessionPackageService,
            LearningEntitlementService entitlementService,
            PaymentEvidenceStorage evidenceStorage
    ) {
        this.accountRepository = accountRepository;
        this.submissionRepository = submissionRepository;
        this.invoiceRepository = invoiceRepository;
        this.teacherRepository = teacherRepository;
        this.ledgerService = ledgerService;
        this.sessionPackageService = sessionPackageService;
        this.entitlementService = entitlementService;
        this.evidenceStorage = evidenceStorage;
    }

    public PaymentBankAccount currentBankAccountOrNull() {
        return accountRepository.findFirstByActiveTrueOrderByUpdatedAtDesc().orElse(null);
    }

    public BankAccountResponse currentBankAccount() {
        return PaymentResponseMapper.toBankAccount(currentBankAccountOrNull());
    }

    public Map<UUID, List<ManualPaymentSubmission>> submissionsByInvoiceForStudent(UUID studentId) {
        return submissionRepository.findByInvoiceStudentIdOrderBySubmittedAtDesc(studentId).stream()
                .collect(Collectors.groupingBy(submission -> submission.getInvoice().getId()));
    }

    @Transactional
    public BankAccountResponse updateBankAccount(UUID adminId, UpdateBankAccountRequest request) {
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        PaymentBankAccount account = currentBankAccountOrNull();
        if (account == null) account = new PaymentBankAccount();
        account.setAccountName(request.accountName().trim());
        account.setBankName(request.bankName().trim());
        account.setAccountNumber(request.accountNumber().trim());
        account.setPaymentReference(cleanOptional(request.paymentReference()));
        account.setInstructions(cleanOptional(request.instructions()));
        account.setActive(true);
        account.setUpdatedByAdmin(admin);
        return PaymentResponseMapper.toBankAccount(accountRepository.save(account));
    }

    @Transactional
    public ManualPaymentResponse submit(
            UUID studentId,
            UUID invoiceId,
            ManualPaymentMethod method,
            BigDecimal amount,
            String note,
            MultipartFile receipt
    ) {
        boolean attached = receipt != null && !receipt.isEmpty();
        if (attached || method != ManualPaymentMethod.CASH) evidenceStorage.validate(receipt);
        if (method == ManualPaymentMethod.BANK_TRANSFER && currentBankAccountOrNull() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Bank transfer is not available yet.");
        }
        StudentInvoice invoice = invoiceRepository.findForStudent(invoiceId, studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        validateOpenInvoice(invoice);
        BigDecimal submittedAmount = money(amount);
        if (submittedAmount.signum() <= 0 || submittedAmount.compareTo(balance(invoice)) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Payment amount must be greater than zero and no more than the balance.");
        }
        if (submissionRepository.existsByInvoiceIdAndStatus(invoiceId, ManualPaymentStatus.PENDING)) {
            throw new ResponseStatusException(CONFLICT, "Payment evidence is already awaiting review for this statement.");
        }

        ManualPaymentSubmission submission = new ManualPaymentSubmission();
        submission.setInvoice(invoice);
        submission.setMethod(method);
        submission.setAmount(submittedAmount);
        submission.setStudentNote(cleanOptional(note));
        if (attached) {
            submission.setOriginalFileName(safeFileName(receipt.getOriginalFilename()));
            submission.setContentType(receipt.getContentType());
            submission.setFileSize(receipt.getSize());
        }
        ManualPaymentSubmission saved = submissionRepository.saveAndFlush(submission);
        if (attached) {
            try {
                evidenceStorage.save(saved.getId(), receipt);
            } catch (RuntimeException ex) {
                submissionRepository.delete(saved);
                throw ex;
            }
        }
        return PaymentResponseMapper.toManualPayment(saved);
    }

    @Transactional
    public AdminManualPaymentsResponse pending(int page, int size) {
        return pending(page, size, null);
    }

    @Transactional
    public AdminManualPaymentsResponse pending(int page, int size, UUID studentId) {
        validatePage(page, size);
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.asc("submittedAt"), Sort.Order.asc("id")));
        var result = studentId == null
                ? submissionRepository.findByStatus(ManualPaymentStatus.PENDING, pageable)
                : submissionRepository.findByStatusAndInvoiceStudentId(ManualPaymentStatus.PENDING, studentId, pageable);
        return new AdminManualPaymentsResponse(
                result.getTotalElements(),
                PageResponse.from(result, PaymentResponseMapper::toManualPayment)
        );
    }

    @Transactional
    public ManualPaymentResponse review(UUID adminId, UUID submissionId, ReviewManualPaymentRequest request) {
        if (request.decision() == ManualPaymentStatus.PENDING) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose approve or reject.");
        }
        if (request.decision() == ManualPaymentStatus.REJECTED && cleanOptional(request.note()) == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Enter a rejection reason so the student knows what to correct.");
        }
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        ManualPaymentSubmission submission = submissionRepository.findByIdForReview(submissionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment submission not found."));
        if (submission.getStatus() != ManualPaymentStatus.PENDING) {
            throw new ResponseStatusException(CONFLICT, "This payment evidence has already been reviewed.");
        }
        submission.setStatus(request.decision());
        submission.setReviewNote(cleanOptional(request.note()));
        submission.setReviewedByAdmin(admin);
        submission.setReviewedAt(Instant.now());
        if (request.decision() == ManualPaymentStatus.APPROVED) {
            recordApprovedPayment(submission);
        }
        return PaymentResponseMapper.toManualPayment(submissionRepository.save(submission));
    }

    @Transactional
    public ReceiptDownload receiptForStudent(UUID studentId, UUID submissionId) {
        ManualPaymentSubmission submission = submissionRepository.findWithInvoiceById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment receipt not found."));
        if (!submission.getInvoice().getStudent().getId().equals(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Payment receipt not found.");
        }
        return receipt(submission);
    }

    @Transactional
    public ReceiptDownload receiptForAdmin(UUID submissionId) {
        ManualPaymentSubmission submission = submissionRepository.findWithInvoiceById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment receipt not found."));
        return receipt(submission);
    }

    private void validateOpenInvoice(StudentInvoice invoice) {
        if (!InvoiceStatusPolicy.current(invoice).isOpen()) {
            throw new ResponseStatusException(BAD_REQUEST, "This payment request is not open.");
        }
    }

    private void recordApprovedPayment(ManualPaymentSubmission submission) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(submission.getInvoice().getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        validateOpenInvoice(invoice);
        if (submission.getAmount().compareTo(balance(invoice)) > 0) {
            throw new ResponseStatusException(CONFLICT, "The submitted amount is now greater than the remaining balance.");
        }
        String provider = submission.getMethod().name();
        ledgerService.recordSuccessfulPayment(
                invoice,
                submission.getAmount(),
                provider,
                provider.toLowerCase().replace('_', '-') + "-" + submission.getId(),
                submission.getSubmittedAt()
        );
        StudentInvoice savedInvoice = invoiceRepository.save(invoice);
        entitlementService.activateForInvoice(savedInvoice);
        sessionPackageService.activateForInvoice(savedInvoice);
    }

    private ReceiptDownload receipt(ManualPaymentSubmission submission) {
        if (submission.getOriginalFileName() == null)
            throw new ResponseStatusException(NOT_FOUND, "No receipt was attached to this payment.");
        return new ReceiptDownload(
                evidenceStorage.load(submission.getId()),
                submission.getOriginalFileName(),
                submission.getContentType()
        );
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid payment review page request.");
        }
    }

    private String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String safeFileName(String value) {
        return BillingFileNames.safeClientName(value, "payment-receipt");
    }

    public record ReceiptDownload(Resource resource, String fileName, String contentType) { }
}
