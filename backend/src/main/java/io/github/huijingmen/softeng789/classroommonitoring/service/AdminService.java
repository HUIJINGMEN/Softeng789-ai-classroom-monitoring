package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AdminService {
    private static final Set<String> VALID_ROLES = Set.of(SessionAuthService.ROLE_TEACHER, SessionAuthService.ROLE_ADMIN);
    private static final Set<String> VALID_STATUSES = Set.of("ACTIVE", "DEACTIVATED");

    private final TeacherRepository teacherRepository;
    private final SessionAuthService sessionAuthService;

    public AdminService(TeacherRepository teacherRepository, SessionAuthService sessionAuthService) {
        this.teacherRepository = teacherRepository;
        this.sessionAuthService = sessionAuthService;
    }

    // Historical sessions still reference the old shared "unassigned teacher" placeholder (see
    // ClassroomSessionService), so the row itself has to stay for referential integrity — but it
    // was never a real staff member and shouldn't be counted or listed as one.
    @Transactional(readOnly = true)
    public List<StaffResponse> listStaff() {
        return teacherRepository.findAll().stream()
                .filter(teacher -> !ClassroomSessionService.DEFAULT_TEACHER_EMAIL.equalsIgnoreCase(teacher.getEmail()))
                .map(this::toResponse)
                .toList();
    }

    /**
     * Creates a passwordless placeholder. Invited teachers claim an exact email/staff-number match
     * through POST /api/auth/register/teacher. Administrator credentials are deliberately not
     * activatable through that public route and must be provisioned through a trusted deployment
     * process.
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

    /**
     * Deactivate/reactivate is deliberately the only way to remove a staff member — see the schema
     * migration note on teachers.status for why an outright DELETE isn't safe here. Going to
     * DEACTIVATED immediately revokes any session this person is currently holding, on top of
     * blocking future logins (see AuthService.login/me).
     */
    @Transactional
    public StaffResponse updateStaffStatus(UUID id, UpdateStaffRequest request, UUID actingAdminId) {
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(status)) {
            throw new ResponseStatusException(BAD_REQUEST, "status must be ACTIVE or DEACTIVATED.");
        }
        Teacher teacher = teacherRepository.findById(id)
                .filter(candidate -> !ClassroomSessionService.DEFAULT_TEACHER_EMAIL.equalsIgnoreCase(candidate.getEmail()))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Staff account not found."));

        if ("DEACTIVATED".equals(status) && teacher.getId().equals(actingAdminId)) {
            throw new ResponseStatusException(BAD_REQUEST, "You cannot deactivate your own account.");
        }

        teacher.setStatus(status);
        teacher = teacherRepository.save(teacher);
        if ("DEACTIVATED".equals(status)) {
            sessionAuthService.revokeSessionsFor(teacher.getId());
        }
        return toResponse(teacher);
    }

    private StaffResponse toResponse(Teacher teacher) {
        return new StaffResponse(
                teacher.getId(),
                teacher.getStaffNumber(),
                teacher.getEmail(),
                teacher.getName(),
                teacher.getRole(),
                teacher.getPasswordHash() != null,
                teacher.getStatus()
        );
    }
}
