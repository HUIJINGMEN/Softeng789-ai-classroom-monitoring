package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentBankAccount;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminBankTransfersResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankTransferResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewBankTransferRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateBankAccountRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.BankTransferSubmissionRepository;
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
public class BankTransferService {
    private static final int MAX_PAGE_SIZE = 100;

    private final PaymentBankAccountRepository accountRepository;
    private final BankTransferSubmissionRepository transferRepository;
    private final StudentInvoiceRepository invoiceRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentLedgerService ledgerService;
    private final BankTransferReceiptStorage receiptStorage;

    public BankTransferService(
            PaymentBankAccountRepository accountRepository,
            BankTransferSubmissionRepository transferRepository,
            StudentInvoiceRepository invoiceRepository,
            TeacherRepository teacherRepository,
            PaymentLedgerService ledgerService,
            BankTransferReceiptStorage receiptStorage
    ) {
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.invoiceRepository = invoiceRepository;
        this.teacherRepository = teacherRepository;
        this.ledgerService = ledgerService;
        this.receiptStorage = receiptStorage;
    }

    public PaymentBankAccount currentBankAccountOrNull() {
        return accountRepository.findFirstByActiveTrueOrderByUpdatedAtDesc().orElse(null);
    }

    public BankAccountResponse currentBankAccount() {
        return PaymentResponseMapper.toBankAccount(currentBankAccountOrNull());
    }

    public Map<UUID, List<BankTransferSubmission>> transfersByInvoiceForStudent(UUID studentId) {
        return transferRepository.findByInvoiceStudentIdOrderBySubmittedAtDesc(studentId).stream()
                .collect(Collectors.groupingBy(transfer -> transfer.getInvoice().getId()));
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
    public BankTransferResponse submit(
            UUID studentId,
            UUID invoiceId,
            BigDecimal amount,
            String note,
            MultipartFile receipt
    ) {
        receiptStorage.validate(receipt);
        if (currentBankAccountOrNull() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Bank transfer is not available yet.");
        }
        StudentInvoice invoice = invoiceRepository.findForStudent(invoiceId, studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        if (invoice.getStatus() == InvoiceStatus.CANCELLED || !invoice.getStatus().isOpen()) {
            throw new ResponseStatusException(BAD_REQUEST, "This payment request is not open.");
        }
        BigDecimal submittedAmount = money(amount);
        if (submittedAmount.signum() <= 0 || submittedAmount.compareTo(balance(invoice)) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Transfer amount must be greater than zero and no more than the balance.");
        }
        if (transferRepository.existsByInvoiceIdAndStatus(invoiceId, BankTransferStatus.PENDING)) {
            throw new ResponseStatusException(CONFLICT, "A receipt for this payment is already awaiting review.");
        }

        BankTransferSubmission transfer = new BankTransferSubmission();
        transfer.setInvoice(invoice);
        transfer.setAmount(submittedAmount);
        transfer.setStudentNote(cleanOptional(note));
        transfer.setOriginalFileName(safeFileName(receipt.getOriginalFilename()));
        transfer.setContentType(receipt.getContentType());
        transfer.setFileSize(receipt.getSize());
        BankTransferSubmission saved = transferRepository.saveAndFlush(transfer);
        try {
            receiptStorage.save(saved.getId(), receipt);
        } catch (RuntimeException ex) {
            transferRepository.delete(saved);
            throw ex;
        }
        return PaymentResponseMapper.toBankTransfer(saved);
    }

    @Transactional
    public AdminBankTransfersResponse pending(int page, int size) {
        validatePage(page, size);
        var result = transferRepository.findByStatus(
                BankTransferStatus.PENDING,
                PageRequest.of(page, size, Sort.by(Sort.Order.asc("submittedAt")))
        );
        return new AdminBankTransfersResponse(
                result.getTotalElements(),
                PageResponse.from(result, PaymentResponseMapper::toBankTransfer)
        );
    }

    @Transactional
    public BankTransferResponse review(UUID adminId, UUID transferId, ReviewBankTransferRequest request) {
        if (request.decision() == BankTransferStatus.PENDING) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose approve or reject.");
        }
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        BankTransferSubmission transfer = transferRepository.findByIdForReview(transferId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Bank transfer submission not found."));
        if (transfer.getStatus() != BankTransferStatus.PENDING) {
            throw new ResponseStatusException(CONFLICT, "This receipt has already been reviewed.");
        }
        transfer.setStatus(request.decision());
        transfer.setReviewNote(cleanOptional(request.note()));
        transfer.setReviewedByAdmin(admin);
        transfer.setReviewedAt(Instant.now());
        if (request.decision() == BankTransferStatus.APPROVED) {
            StudentInvoice invoice = invoiceRepository.findByIdForUpdate(transfer.getInvoice().getId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
            if (transfer.getAmount().compareTo(balance(invoice)) > 0) {
                throw new ResponseStatusException(CONFLICT, "The submitted amount is now greater than the remaining balance.");
            }
            ledgerService.recordSuccessfulPayment(
                    invoice,
                    transfer.getAmount(),
                    "BANK_TRANSFER",
                    "bank-transfer-" + transfer.getId(),
                    transfer.getSubmittedAt()
            );
            invoiceRepository.save(invoice);
        }
        return PaymentResponseMapper.toBankTransfer(transferRepository.save(transfer));
    }

    @Transactional
    public ReceiptDownload receiptForStudent(UUID studentId, UUID transferId) {
        BankTransferSubmission transfer = transferRepository.findWithInvoiceById(transferId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment receipt not found."));
        if (!transfer.getInvoice().getStudent().getId().equals(studentId)) {
            throw new ResponseStatusException(NOT_FOUND, "Payment receipt not found.");
        }
        return receipt(transfer);
    }

    @Transactional
    public ReceiptDownload receiptForAdmin(UUID transferId) {
        BankTransferSubmission transfer = transferRepository.findWithInvoiceById(transferId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment receipt not found."));
        return receipt(transfer);
    }

    private ReceiptDownload receipt(BankTransferSubmission transfer) {
        return new ReceiptDownload(
                receiptStorage.load(transfer.getId()),
                transfer.getOriginalFileName(),
                transfer.getContentType()
        );
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid bank transfer page request.");
        }
    }

    private String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String safeFileName(String value) {
        if (value == null || value.isBlank()) return "payment-receipt";
        return value.replaceAll("[\\r\\n\\\\/]", "_").trim();
    }

    public record ReceiptDownload(Resource resource, String fileName, String contentType) { }
}
