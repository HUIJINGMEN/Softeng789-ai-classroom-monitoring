package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherRepository extends JpaRepository<Teacher, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from Teacher t where t.id = :id")
    Optional<Teacher> findForReportPreparation(UUID id);
    Optional<Teacher> findByEmailIgnoreCase(String email);

    Optional<Teacher> findByStaffNumberIgnoreCase(String staffNumber);
}
