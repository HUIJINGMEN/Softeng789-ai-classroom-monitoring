package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Shared caller-resolution and class-ownership checks for any service that needs to scope its
 *  results to "this teacher's own classes" — originally written for the Health Alert / Health
 *  Incident Report services, now also used by StudentService and ClassroomSessionService, all of
 *  which need the exact same "who is this, are they admin, do they teach this class" logic. */
@Component
public class TeacherScopeSupport {
    private final TeacherRepository teacherRepository;

    TeacherScopeSupport(TeacherRepository teacherRepository) {
        this.teacherRepository = teacherRepository;
    }

    public Teacher requireCaller(UUID callerId) {
        return requireActive(teacherRepository.findById(callerId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Signed-in staff member not found.")));
    }

    /** Call first in the short persistence transaction after external work, never across AI/SMTP.
     *  The shared row lock serializes the commit with account deactivation: a deactivation that
     *  commits first is rejected; otherwise it waits until this authorized write has committed. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Teacher requireCallerForWrite(UUID callerId) {
        return requireActive(teacherRepository.findForAuthorization(callerId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Signed-in staff member not found.")));
    }

    private Teacher requireActive(Teacher caller) {
        if (!"ACTIVE".equals(caller.getStatus())) {
            throw new ResponseStatusException(FORBIDDEN, "Your staff account is no longer active.");
        }
        return caller;
    }

    public boolean isAdmin(Teacher caller) {
        return SessionAuthService.ROLE_ADMIN.equals(caller.getRole());
    }

    /** Admins can access every class; a teacher only their own. Denies (rather than NPEs) when
     *  there's no offering to check against — e.g. an alert whose session predates the
     *  course_offering_id column being made mandatory. */
    public void assertCanAccessOffering(CourseOffering offering, Teacher caller) {
        if (isAdmin(caller)) {
            return;
        }
        if (offering == null || !offering.isTaughtBy(caller)) {
            throw new ResponseStatusException(FORBIDDEN, "You can only access your own classes.");
        }
    }

    String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
