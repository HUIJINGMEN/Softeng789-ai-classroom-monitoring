package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminBankTransfersResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankTransferResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoicesResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewBankTransferRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateBankAccountRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.BankTransferService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import java.math.BigDecimal;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api")
public class PaymentController {
    private final PaymentService paymentService;
    private final SessionAuthService sessionAuthService;
    private final BankTransferService bankTransferService;

    public PaymentController(
            PaymentService paymentService,
            SessionAuthService sessionAuthService,
            BankTransferService bankTransferService
    ) {
        this.paymentService = paymentService;
        this.sessionAuthService = sessionAuthService;
        this.bankTransferService = bankTransferService;
    }

    @GetMapping("/students/{studentId}/payments")
    public StudentStatementResponse studentStatement(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.statement(studentId);
    }

    @PostMapping("/students/{studentId}/payments/{invoiceId}/checkout")
    public CheckoutResponse checkout(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.checkout(studentId, invoiceId);
    }

    @GetMapping("/admin/payments")
    public AdminPaymentsResponse adminPayments(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return paymentService.adminList(query, status, page, size);
    }

    @PostMapping("/admin/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateInvoicesResponse createPaymentRequests(
            @Valid @RequestBody CreateInvoiceRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return paymentService.create(adminId, request);
    }

    @PutMapping("/admin/payments/bank-account")
    public BankAccountResponse updateBankAccount(
            @Valid @RequestBody UpdateBankAccountRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return bankTransferService.updateBankAccount(adminId, request);
    }

    @GetMapping("/admin/payments/bank-account")
    public BankAccountResponse bankAccount(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return bankTransferService.currentBankAccount();
    }

    @PostMapping(value = "/students/{studentId}/payments/{invoiceId}/bank-transfer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public BankTransferResponse submitBankTransfer(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestPart("amount") String amount,
            @RequestPart(value = "note", required = false) String note,
            @RequestPart("receipt") MultipartFile receipt,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return bankTransferService.submit(studentId, invoiceId, parseAmount(amount), note, receipt);
    }

    @GetMapping("/admin/payments/bank-transfers")
    public AdminBankTransfersResponse pendingBankTransfers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return bankTransferService.pending(page, size);
    }

    @PostMapping("/admin/payments/bank-transfers/{transferId}/review")
    public BankTransferResponse reviewBankTransfer(
            @PathVariable UUID transferId,
            @Valid @RequestBody ReviewBankTransferRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return bankTransferService.review(adminId, transferId, request);
    }

    @GetMapping("/students/{studentId}/payments/bank-transfers/{transferId}/receipt")
    public ResponseEntity<Resource> studentBankTransferReceipt(
            @PathVariable UUID studentId,
            @PathVariable UUID transferId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return receiptResponse(bankTransferService.receiptForStudent(studentId, transferId));
    }

    @GetMapping("/admin/payments/bank-transfers/{transferId}/receipt")
    public ResponseEntity<Resource> adminBankTransferReceipt(
            @PathVariable UUID transferId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return receiptResponse(bankTransferService.receiptForAdmin(transferId));
    }

    private ResponseEntity<Resource> receiptResponse(BankTransferService.ReceiptDownload receipt) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(receipt.contentType()))
                .header(
                        "Content-Disposition",
                        ContentDisposition.inline().filename(receipt.fileName()).build().toString()
                )
                .body(receipt.resource());
    }

    private BigDecimal parseAmount(String amount) {
        try {
            return new BigDecimal(amount);
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Enter a valid transfer amount.", ex);
        }
    }
}
