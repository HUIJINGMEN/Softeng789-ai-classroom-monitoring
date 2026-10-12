package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import java.util.Collection;
import java.util.UUID;
import java.util.List;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentLearningEntitlementRepository extends JpaRepository<StudentLearningEntitlement, UUID> {
    @EntityGraph(attributePaths = {"student", "invoice", "courseOffering", "classroomSession"})
    List<StudentLearningEntitlement> findByCourseOffering_IdOrderByCreatedAtDesc(UUID courseOfferingId);

    @EntityGraph(attributePaths = {"student", "invoice", "courseOffering", "courseOffering.course", "classroomSession"})
    List<StudentLearningEntitlement> findByStudent_IdIn(Collection<UUID> studentIds);

    boolean existsByStudent_IdAndCourseOffering_IdAndPurchaseModeAndStatusIn(
            UUID studentId,
            UUID courseOfferingId,
            CoursePurchaseMode purchaseMode,
            Collection<LearningEntitlementStatus> statuses
    );

    boolean existsByStudent_IdAndClassroomSession_IdAndStatusIn(
            UUID studentId,
            UUID classroomSessionId,
            Collection<LearningEntitlementStatus> statuses
    );

    boolean existsByStudent_IdAndCourseOffering_IdAndPurchaseModeAndValidFromLessThanEqualAndValidToGreaterThanEqualAndStatusIn(
            UUID studentId,
            UUID courseOfferingId,
            CoursePurchaseMode purchaseMode,
            LocalDate validTo,
            LocalDate validFrom,
            Collection<LearningEntitlementStatus> statuses
    );

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course"})
    List<StudentLearningEntitlement> findByPurchaseModeAndStatusAndValidToBetween(
            CoursePurchaseMode purchaseMode,
            LearningEntitlementStatus status,
            LocalDate from,
            LocalDate to
    );
}
