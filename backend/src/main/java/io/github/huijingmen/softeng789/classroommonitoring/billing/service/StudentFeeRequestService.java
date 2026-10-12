package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.FeeRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentFeeRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminFeeRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.DeclineFeeRequestRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.FeeRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.QuoteFeeRequestRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentFeeRequestRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class StudentFeeRequestService {
    private static final int MAX_PAGE_SIZE = 100;
    private final StudentFeeRequestRepository requestRepository;
    private final StudentInvoiceRepository invoiceRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PaymentEvidenceStorage evidenceStorage;
    private final PaymentService paymentService;

    public StudentFeeRequestService(
            StudentFeeRequestRepository requestRepository,
            StudentInvoiceRepository invoiceRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            PaymentEvidenceStorage evidenceStorage,
            PaymentService paymentService
    ) {
        this.requestRepository = requestRepository;
        this.invoiceRepository = invoiceRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.evidenceStorage = evidenceStorage;
        this.paymentService = paymentService;
    }

    @Transactional
    public FeeRequestResponse submit(
            UUID studentId,
            String title,
            String details,
            MultipartFile evidence
    ) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        StudentFeeRequest request = new StudentFeeRequest();
        request.setStudent(student);
        request.setTitle(required(title, "Enter a short request title.", 160));
        request.setRequestDetails(required(details, "Describe what you need.", 2000));
        if (evidence != null && !evidence.isEmpty()) {
            request.setEvidenceFileName(cleanFileName(evidence.getOriginalFilename()));
            request.setEvidenceContentType(evidence.getContentType());
            request.setEvidenceFileSize(evidence.getSize());
        }
        StudentFeeRequest saved = requestRepository.save(request);
        if (evidence != null && !evidence.isEmpty()) evidenceStorage.saveFeeRequest(saved.getId(), evidence);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FeeRequestResponse> studentRequests(UUID studentId) {
        return requestRepository.findByStudent_IdOrderBySubmittedAtDesc(studentId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AdminFeeRequestsResponse adminRequests(FeeRequestStatus status, int page, int size) {
        validatePage(page, size);
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "submittedAt"));
        Page<StudentFeeRequest> requests = status == null
                ? requestRepository.findAllByOrderBySubmittedAtDesc(pageable)
                : requestRepository.findByStatus(status, pageable);
        return new AdminFeeRequestsResponse(
                requestRepository.countByStatus(FeeRequestStatus.SUBMITTED),
                PageResponse.from(requests, this::toResponse)
        );
    }

    @Transactional
    public FeeRequestResponse quote(UUID adminId, UUID requestId, QuoteFeeRequestRequest quote) {
        StudentFeeRequest request = requireSubmittedForReview(requestId);
        CreateInvoiceRequest invoiceRequest = new CreateInvoiceRequest(
                List.of(request.getStudent().getId()),
                quote.invoiceTitle(),
                quote.note(),
                quote.dueDate(),
                quote.lineItems(),
                null
        );
        UUID invoiceId = paymentService.create(adminId, invoiceRequest).invoices().getFirst().id();
        request.setInvoice(invoiceRepository.getReferenceById(invoiceId));
        request.setReviewedByAdmin(requireAdmin(adminId));
        request.setStatus(FeeRequestStatus.INVOICED);
        request.setReviewedAt(Instant.now());
        return toResponse(requestRepository.save(request));
    }

    @Transactional
    public FeeRequestResponse decline(UUID adminId, UUID requestId, DeclineFeeRequestRequest decision) {
        StudentFeeRequest request = requireSubmittedForReview(requestId);
        request.setReviewedByAdmin(requireAdmin(adminId));
        request.setStatus(FeeRequestStatus.DECLINED);
        request.setReviewNote(decision.note().trim());
        request.setReviewedAt(Instant.now());
        return toResponse(requestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public EvidenceDownload evidenceForStudent(UUID studentId, UUID requestId) {
        StudentFeeRequest request = requireRequest(requestId);
        if (!request.getStudent().getId().equals(studentId)) throw notFound();
        return evidence(request);
    }

    @Transactional(readOnly = true)
    public EvidenceDownload evidenceForAdmin(UUID requestId) {
        return evidence(requireRequest(requestId));
    }

    private EvidenceDownload evidence(StudentFeeRequest request) {
        if (request.getEvidenceFileName() == null) throw notFound();
        Resource resource = evidenceStorage.loadFeeRequest(request.getId());
        return new EvidenceDownload(resource, request.getEvidenceFileName(), request.getEvidenceContentType());
    }

    private StudentFeeRequest requireSubmittedForReview(UUID requestId) {
        StudentFeeRequest request = requestRepository.findByIdForReview(requestId)
                .orElseThrow(StudentFeeRequestService::notFound);
        if (request.getStatus() != FeeRequestStatus.SUBMITTED) {
            throw new ResponseStatusException(BAD_REQUEST, "This request has already been reviewed.");
        }
        return request;
    }

    private StudentFeeRequest requireRequest(UUID requestId) {
        return requestRepository.findById(requestId).orElseThrow(StudentFeeRequestService::notFound);
    }

    private Teacher requireAdmin(UUID adminId) {
        return teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
    }

    private FeeRequestResponse toResponse(StudentFeeRequest request) {
        return new FeeRequestResponse(
                request.getId(), request.getStudent().getId(), request.getStudent().getFullName(),
                request.getStudent().getStudentNumber(), request.getTitle(), request.getRequestDetails(),
                request.getStatus(), request.getEvidenceFileName(), request.getEvidenceContentType(),
                request.getEvidenceFileSize(), request.getInvoice() == null ? null : request.getInvoice().getId(),
                request.getReviewNote(), request.getSubmittedAt(), request.getReviewedAt()
        );
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid fee-request page.");
        }
    }

    private String required(String value, String message, int maxLength) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(BAD_REQUEST, message);
        String cleaned = value.trim();
        if (cleaned.length() > maxLength) throw new ResponseStatusException(BAD_REQUEST, message);
        return cleaned;
    }

    private String cleanFileName(String value) {
        return BillingFileNames.safeClientName(value, "evidence");
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(NOT_FOUND, "Fee request or evidence not found.");
    }

    public record EvidenceDownload(Resource resource, String fileName, String contentType) {
    }
}
