package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import java.time.LocalDate;

public interface StudentSessionPackageRepository extends JpaRepository<StudentSessionPackage, UUID> {
    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    List<StudentSessionPackage> findByInvoice_IdIn(Collection<UUID> invoiceIds);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    List<StudentSessionPackage> findByInvoice_IdOrderByCreatedAtAsc(UUID invoiceId);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    Optional<StudentSessionPackage> findById(UUID id);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice", "entitlement"})
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sessionPackage from StudentSessionPackage sessionPackage where sessionPackage.id = :id")
    Optional<StudentSessionPackage> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    List<StudentSessionPackage> findByStatusAndServiceToGreaterThanEqual(
            SessionPackageStatus status,
            LocalDate serviceTo
    );

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    List<StudentSessionPackage> findByCourseOffering_IdOrderByCreatedAtDesc(UUID courseOfferingId);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "invoice"})
    List<StudentSessionPackage> findByStudent_IdAndCourseOffering_IdInOrderByCreatedAtAsc(
            UUID studentId,
            Collection<UUID> courseOfferingIds
    );
}
