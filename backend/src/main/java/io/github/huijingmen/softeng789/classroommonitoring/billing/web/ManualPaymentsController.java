package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminManualPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ManualPaymentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewManualPaymentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateBankAccountRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.ManualPaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.UUID;
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

/** Manual payment submission, evidence download and administrator review endpoints. */
@RestController
@RequestMapping("/api")
public class ManualPaymentsController {
    private final ManualPaymentService manualPaymentService;
    private final SessionAuthService sessionAuthService;

    public ManualPaymentsController(ManualPaymentService manualPaymentService, SessionAuthService sessionAuthService) {
        this.manualPaymentService = manualPaymentService;
        this.sessionAuthService = sessionAuthService;
    }

    @PutMapping("/admin/payments/bank-account")
    public BankAccountResponse updateBankAccount(
            @Valid @RequestBody UpdateBankAccountRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return manualPaymentService.updateBankAccount(sessionAuthService.requireAdmin(authorization), request);
    }

    @GetMapping("/admin/payments/bank-account")
    public BankAccountResponse bankAccount(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return manualPaymentService.currentBankAccount();
    }

    @PostMapping(
            value = "/students/{studentId}/payments/{invoiceId}/manual-payment",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @ResponseStatus(HttpStatus.CREATED)
    public ManualPaymentResponse submit(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestParam("amount") String amount,
            @RequestParam("method") ManualPaymentMethod method,
            @RequestParam(value = "note", required = false) String note,
            @RequestPart(value = "receipt", required = false) MultipartFile receipt,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return manualPaymentService.submit(studentId, invoiceId, method, parseAmount(amount), note, receipt);
    }

    @GetMapping("/admin/payments/manual-payments")
    public AdminManualPaymentsResponse pending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return manualPaymentService.pending(page, size);
    }

    @PostMapping("/admin/payments/manual-payments/{submissionId}/review")
    public ManualPaymentResponse review(
            @PathVariable UUID submissionId,
            @Valid @RequestBody ReviewManualPaymentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return manualPaymentService.review(sessionAuthService.requireAdmin(authorization), submissionId, request);
    }

    @GetMapping("/students/{studentId}/payments/manual-payments/{submissionId}/receipt")
    public ResponseEntity<Resource> studentReceipt(
            @PathVariable UUID studentId,
            @PathVariable UUID submissionId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return receiptResponse(manualPaymentService.receiptForStudent(studentId, submissionId));
    }

    @GetMapping("/admin/payments/manual-payments/{submissionId}/receipt")
    public ResponseEntity<Resource> adminReceipt(
            @PathVariable UUID submissionId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return receiptResponse(manualPaymentService.receiptForAdmin(submissionId));
    }

    private ResponseEntity<Resource> receiptResponse(ManualPaymentService.ReceiptDownload receipt) {
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
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Enter a valid payment amount.", exception);
        }
    }
}
