package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentDirectoryFilter;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.StudentChargeSuggestionsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentDirectoryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.ManualPaymentSubmissionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.Collection;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Coordinates persistence reads for the student-centred administrator payment directory. */
@Service
public class StudentPaymentAccountService {
    private static final int MAX_PAGE_SIZE = 100;

    private final StudentRepository studentRepository;
    private final StudentInvoiceRepository invoiceRepository;
    private final ManualPaymentSubmissionRepository manualPaymentRepository;
    private final InvoiceSuggestionService suggestionService;

    public StudentPaymentAccountService(
            StudentRepository studentRepository,
            StudentInvoiceRepository invoiceRepository,
            ManualPaymentSubmissionRepository manualPaymentRepository,
            InvoiceSuggestionService suggestionService
    ) {
        this.studentRepository = studentRepository;
        this.invoiceRepository = invoiceRepository;
        this.manualPaymentRepository = manualPaymentRepository;
        this.suggestionService = suggestionService;
    }

    @Transactional
    public StudentPaymentDirectoryResponse directory(
            String query,
            StudentPaymentDirectoryFilter filter,
            int page,
            int size
    ) {
        validatePage(page, size);
        List<StudentPaymentAccountRowResponse> rows = accounts(query, null);
        List<StudentPaymentAccountRowResponse> filteredRows = rows.stream()
                .filter(row -> StudentPaymentAccountPolicy.matches(filter, row.state()))
                .toList();
        return new StudentPaymentDirectoryResponse(
                StudentPaymentAccountAssembler.summary(rows),
                PageResponse.fromList(filteredRows, PageRequest.of(page, size), Function.identity())
        );
    }

    /** Batched account projection shared by the register; no repeated directory page scans. */
    @Transactional
    public List<StudentPaymentAccountRowResponse> accounts(String query, Collection<UUID> selectedStudentIds) {
        List<Student> students = selectedStudentIds == null
                ? studentRepository.searchActiveBillingStudents(clean(query))
                : studentRepository.findAllById(selectedStudentIds).stream()
                        .filter(student -> "ACTIVE".equals(student.getStatus())
                                && "APPROVED".equals(student.getApprovalStatus())).toList();
        return projectAccounts(students);
    }

    /** Single-class registers never load accounts belonging only to other classes. */
    @Transactional
    public List<StudentPaymentAccountRowResponse> accountsForClass(UUID offeringId) {
        return projectAccounts(studentRepository.findActiveStudentsInCourseOffering(offeringId));
    }

    private List<StudentPaymentAccountRowResponse> projectAccounts(List<Student> students) {
        if (students.isEmpty()) {
            return List.of();
        }

        LocalDate today = BillingDates.today();
        List<UUID> studentIds = students.stream().map(Student::getId).toList();
        Map<UUID, List<StudentInvoice>> invoicesByStudent = invoicesByStudent(studentIds);
        Map<UUID, List<ManualPaymentSubmission>> evidenceByStudent = pendingEvidenceByStudent(studentIds);
        Map<UUID, StudentChargeSuggestionsResponse> suggestionsByStudent = suggestionsByStudent(studentIds, today);

        return students.stream()
                .map(student -> StudentPaymentAccountAssembler.row(
                        student,
                        invoicesByStudent.getOrDefault(student.getId(), List.of()),
                        evidenceByStudent.getOrDefault(student.getId(), List.of()),
                        suggestionsByStudent.get(student.getId()), today
                ))
                .sorted(StudentPaymentAccountPolicy.accountOrder())
                .toList();
    }

    private Map<UUID, List<StudentInvoice>> invoicesByStudent(List<UUID> studentIds) {
        return invoiceRepository.findByStudent_IdInOrderByDueDateAscCreatedAtDesc(studentIds).stream()
                .collect(Collectors.groupingBy(invoice -> invoice.getStudent().getId()));
    }

    private Map<UUID, List<ManualPaymentSubmission>> pendingEvidenceByStudent(List<UUID> studentIds) {
        return manualPaymentRepository.findByInvoice_Student_IdInAndStatusOrderBySubmittedAtAsc(
                studentIds,
                ManualPaymentStatus.PENDING
        ).stream().collect(Collectors.groupingBy(submission -> submission.getInvoice().getStudent().getId()));
    }

    private Map<UUID, StudentChargeSuggestionsResponse> suggestionsByStudent(List<UUID> studentIds, LocalDate today) {
        return suggestionService.preview(
                new ChargeSuggestionPreviewRequest(studentIds, null, today)
        ).students().stream().collect(Collectors.toMap(StudentChargeSuggestionsResponse::studentId, Function.identity()));
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid student payment page request.");
        }
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
