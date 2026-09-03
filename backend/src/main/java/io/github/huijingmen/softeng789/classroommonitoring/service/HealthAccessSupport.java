package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Shared caller-resolution and class-ownership checks for the Health Alert / Health Incident
 *  Report services — both need the exact same "who is this, are they admin, do they teach this
 *  class" logic, so it lives here once instead of being copy-pasted in each service. */
@Component
class HealthAccessSupport {
    private final TeacherRepository teacherRepository;

    HealthAccessSupport(TeacherRepository teacherRepository) {
        this.teacherRepository = teacherRepository;
    }

    Teacher requireCaller(UUID callerId) {
        return teacherRepository.findById(callerId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Signed-in staff member not found."));
    }

    boolean isAdmin(Teacher caller) {
        return SessionAuthService.ROLE_ADMIN.equals(caller.getRole());
    }

    /** Admins can access every class; a teacher only their own. Denies (rather than NPEs) when
     *  there's no offering to check against — e.g. an alert whose session predates the
     *  course_offering_id column being made mandatory. */
    void assertCanAccessOffering(CourseOffering offering, Teacher caller) {
        if (isAdmin(caller)) {
            return;
        }
        if (offering == null || !offering.isTaughtBy(caller)) {
            throw new ResponseStatusException(FORBIDDEN, "You can only access health data for your own classes.");
        }
    }

    String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
