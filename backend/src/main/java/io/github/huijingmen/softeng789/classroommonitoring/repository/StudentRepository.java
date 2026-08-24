package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, UUID> {
    Optional<Student> findByStudentNumberIgnoreCase(String studentNumber);

    Optional<Student> findByUniversityEmailIgnoreCase(String universityEmail);

    List<Student> findByCourseIgnoreCaseOrderByLastNameAscFirstNameAsc(String course);
}
