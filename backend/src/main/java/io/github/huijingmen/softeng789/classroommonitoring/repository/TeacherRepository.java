package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface TeacherRepository extends JpaRepository<Teacher, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Teacher t where t.id = :id")
    Optional<Teacher> findForReportPreparation(UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from Teacher t where t.id = :id")
    Optional<Teacher> findForAuthorization(UUID id);

    Optional<Teacher> findByEmailIgnoreCase(String email);

    Optional<Teacher> findByStaffNumberIgnoreCase(String staffNumber);
}
