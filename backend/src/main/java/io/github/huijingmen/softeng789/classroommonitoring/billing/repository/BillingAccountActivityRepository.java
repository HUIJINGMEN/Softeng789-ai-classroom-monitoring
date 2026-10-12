package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BillingAccountActivity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BillingAccountActivityRepository extends JpaRepository<BillingAccountActivity, UUID> {
    @EntityGraph(attributePaths = {"actor", "student", "invoice", "sessionPackage"})
    List<BillingAccountActivity> findByInvoice_IdOrderByCreatedAtDesc(UUID invoiceId);
}
