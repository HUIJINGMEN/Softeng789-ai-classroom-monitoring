package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonReconciliationService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.StudentPaymentAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewDtos.Register;
import static io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewDtos.StudentRecords;

/** One HTTP page, one calculation per class; full-scope counts stay independent of pagination. */
@Service
public class StudentOverviewService {
    private final CourseOfferingRepository offerings;
    private final StudentPaymentAccountService accounts;
    private final LessonReconciliationService reconciliation;

    public StudentOverviewService(CourseOfferingRepository offerings, StudentPaymentAccountService accounts,
                                  LessonReconciliationService reconciliation) {
        this.offerings = offerings;
        this.accounts = accounts;
        this.reconciliation = reconciliation;
    }

    @Transactional
    public Register page(UUID offeringId, LocalDate weekStart, ReconciliationView view, String query,
                         boolean exceptionsOnly, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ResponseStatusException(BAD_REQUEST, "Invalid register page.");
        List<CourseOffering> classes = classes(offeringId);
        List<StudentPaymentAccountRowResponse> accountRows = offeringId == null
                ? accounts.accounts("", null) : accounts.accountsForClass(offeringId);
        List<StudentPaymentAccountRowResponse> candidates = accountRows.stream()
                .filter(account -> StudentOverviewPolicy.matches(account, query)).toList();
        Set<UUID> candidateIds = candidates.stream().map(StudentPaymentAccountRowResponse::studentId).collect(Collectors.toSet());
        List<LessonReconciliationResponse> registers = classes.stream()
                .map(offering -> reconciliation.forStudents(offering.getId(), weekStart,
                        offeringId == null ? ReconciliationView.WEEK : view, candidateIds)).toList();
        return StudentOverviewProjection.page(candidates, registers, offeringId != null, exceptionsOnly, page, size);
    }

    /** Refresh only one student's account and the selected class, not all class registers. */
    @Transactional
    public StudentRecords student(UUID offeringId, UUID studentId, LocalDate weekStart, ReconciliationView view) {
        classes(offeringId);
        List<StudentPaymentAccountRowResponse> items = accounts.accounts("", Set.of(studentId));
        if (items.isEmpty()) throw new ResponseStatusException(NOT_FOUND, "Active student not found.");
        LessonReconciliationResponse register = reconciliation.forStudents(offeringId, weekStart, view, Set.of(studentId));
        if (register.rows().isEmpty()) throw new ResponseStatusException(NOT_FOUND, "Student is no longer enrolled in this class.");
        return new StudentRecords(items, List.of(register));
    }

    private List<CourseOffering> classes(UUID offeringId) {
        if (offeringId == null) return offerings.findAllByStatusOrderByOfferingCodeAsc("ACTIVE");
        CourseOffering offering = offerings.findById(offeringId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        if (!"ACTIVE".equals(offering.getStatus())) throw new ResponseStatusException(BAD_REQUEST, "Class is not active.");
        return List.of(offering);
    }

}
