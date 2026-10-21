package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsDashboardResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Loads one consistent read snapshot and delegates financial, follow-up and class projections. */
@Service
public class BillingOperationsService {
    private final StudentInvoiceRepository invoiceRepository;
    private final StudentSessionPackageRepository packageRepository;
    private final LessonCreditRepository creditRepository;
    private final BillingOperationsFinancials financials;
    private final BillingOperationsAlerts alerts;

    public BillingOperationsService(StudentInvoiceRepository invoiceRepository,
            StudentSessionPackageRepository packageRepository, LessonCreditRepository creditRepository,
            BillingOperationsFinancials financials, BillingOperationsAlerts alerts) {
        this.invoiceRepository = invoiceRepository;
        this.packageRepository = packageRepository;
        this.creditRepository = creditRepository;
        this.financials = financials;
        this.alerts = alerts;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OperationsDashboardResponse dashboard() {
        LocalDate today = BillingDates.today();
        return dashboard(today.withDayOfYear(1), today);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OperationsDashboardResponse dashboard(LocalDate from, LocalDate to) {
        validatePeriod(from, to);
        Instant asOf = Instant.now();
        LocalDate today = asOf.atZone(BillingDates.BUSINESS_ZONE).toLocalDate();
        List<StudentInvoice> invoices = invoiceRepository.findForOperations();
        var money = financials.load(invoices, from, to, asOf);
        List<StudentSessionPackage> packages = packagesFor(invoices.stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatus.CANCELLED).toList());
        var credits = packages.isEmpty() ? List.<LessonCredit>of()
                : creditRepository.findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(
                        packages.stream().map(StudentSessionPackage::getId).toList());
        return new OperationsDashboardResponse(money.summary(), alerts.build(invoices, today, today.plusDays(14)),
                BillingCourseProjection.from(invoices, credits, money.invoices()), from, to, asOf);
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose a valid reporting period.");
        }
        if (to.isAfter(from.plusYears(1))) {
            throw new ResponseStatusException(BAD_REQUEST, "Reporting periods can cover at most one year.");
        }
    }

    private List<StudentSessionPackage> packagesFor(List<StudentInvoice> invoices) {
        List<UUID> invoiceIds = invoices.stream().map(StudentInvoice::getId).toList();
        return invoiceIds.isEmpty() ? List.of() : packageRepository.findByInvoice_IdIn(invoiceIds);
    }
}
