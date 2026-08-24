package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
public class AdminService {
    private static final Set<String> VALID_ROLES = Set.of(AuthService.ROLE_TEACHER, AuthService.ROLE_ADMIN);

    private final TeacherRepository teacherRepository;

    public AdminService(TeacherRepository teacherRepository) {
        this.teacherRepository = teacherRepository;
    }

    @Transactional(readOnly = true)
    public List<StaffResponse> listStaff() {
        return teacherRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Creates a passwordless placeholder, the same way a classroom session used to auto-create a
     * teacher stub — the invited person claims it (and sets their own password) through the
     * existing POST /api/auth/register/teacher flow, which never changes the role it was given.
     */
    @Transactional
    public StaffResponse createStaff(CreateStaffRequest request) {
        String role = request.role().trim().toUpperCase(Locale.ROOT);
        if (!VALID_ROLES.contains(role)) {
            throw new ResponseStatusException(BAD_REQUEST, "role must be TEACHER or ADMIN.");
        }
        String staffNumber = request.staffNumber().trim();
        String email = request.email().trim();

        if (teacherRepository.findByStaffNumberIgnoreCase(staffNumber).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That staff ID is already registered.");
        }
        if (teacherRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That email is already registered.");
        }

        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName(request.name().trim());
        teacher.setRole(role);
        teacher = teacherRepository.save(teacher);

        return toResponse(teacher);
    }

    private StaffResponse toResponse(Teacher teacher) {
        return new StaffResponse(
                teacher.getId(),
                teacher.getStaffNumber(),
                teacher.getEmail(),
                teacher.getName(),
                teacher.getRole(),
                teacher.getPasswordHash() != null
        );
    }
}
