package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ClassroomSessionService {
    // Historical rows already reference this account (it used to be auto-created whenever a
    // session was scheduled with no teacher specified) — those are left alone. What changed is
    // that nothing creates new ones anymore; this constant only remains so AuthService can keep
    // refusing to let the shared identity be claimed.
    public static final String DEFAULT_TEACHER_EMAIL = "unassigned.teacher@auckland.ac.nz";
    private static final String OFFERING_STATUS_ACTIVE = "ACTIVE";

    private final ClassroomSessionRepository classroomSessionRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final RoomRepository roomRepository;
    private final TeacherRepository teacherRepository;

    public ClassroomSessionService(
            ClassroomSessionRepository classroomSessionRepository,
            CourseOfferingRepository courseOfferingRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository
    ) {
        this.classroomSessionRepository = classroomSessionRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.roomRepository = roomRepository;
        this.teacherRepository = teacherRepository;
    }

    @Transactional(readOnly = true)
    public List<ClassroomSessionResponse> listSessions() {
        return classroomSessionRepository.findAllByOrderByDateDescStartTimeDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClassroomSessionResponse getSession(UUID id) {
        return toResponse(findEntity(id));
    }

    @Transactional
    public ClassroomSessionResponse createSession(CreateClassroomSessionRequest request) {
        ClassroomSession session = new ClassroomSession();
        apply(session, request.courseOfferingId(), request.room(), request.teacherEmail(),
                request.teacherStaffNumber(), request.date(), request.startTime(),
                request.endTime(), request.status() == null ? SessionStatus.SCHEDULED : request.status());
        return toResponse(classroomSessionRepository.save(session));
    }

    // Once a session is COMPLETED it's a historical record — editing it after the fact would mean
    // silently rewriting what the system says happened, with no way to tell an honest correction
    // from someone covering something up after attendance was already taken. CANCELLED is
    // terminal for the same reason: it already recorded the "this isn't happening" decision.
    // SCHEDULED and ACTIVE are still fair game — a wrong room or time can be fixed up to and
    // during the class itself.
    private void requireEditable(ClassroomSession session) {
        if (session.getStatus() == SessionStatus.COMPLETED || session.getStatus() == SessionStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This session has already " + (session.getStatus() == SessionStatus.CANCELLED
                            ? "been cancelled"
                            : "ended") + " and can no longer be changed.");
        }
    }

    @Transactional
    public ClassroomSessionResponse updateSession(UUID id, UpdateClassroomSessionRequest request) {
        ClassroomSession session = findEntity(id);
        requireEditable(session);
        apply(session, request.courseOfferingId(), request.room(), request.teacherEmail(),
                request.teacherStaffNumber(), request.date(), request.startTime(),
                request.endTime(), request.status());
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse startSession(UUID id) {
        ClassroomSession session = findEntity(id);
        requireEditable(session);
        session.setStatus(SessionStatus.ACTIVE);
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse endSession(UUID id) {
        ClassroomSession session = findEntity(id);
        requireEditable(session);
        session.setStatus(SessionStatus.COMPLETED);
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse cancelSession(UUID id) {
        ClassroomSession session = findEntity(id);
        requireEditable(session);
        session.setStatus(SessionStatus.CANCELLED);
        return toResponse(classroomSessionRepository.save(session));
    }

    ClassroomSession findEntity(UUID id) {
        return classroomSessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
    }

    private void apply(
            ClassroomSession session,
            UUID courseOfferingId,
            String room,
            String teacherEmail,
            String teacherStaffNumber,
            java.time.LocalDate date,
            java.time.Instant startTime,
            java.time.Instant endTime,
            SessionStatus status
    ) {
        if (!endTime.isAfter(startTime)) {
            throw new ResponseStatusException(BAD_REQUEST, "Session end time must be after start time.");
        }
        CourseOffering offering = requireActiveOffering(courseOfferingId);
        if (offering.getTeachers().isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This class has no assigned teacher. Please assign a teacher before creating the session.");
        }
        Room canonicalRoom = findOrCreateRoom(room);
        Teacher teacher = requireClassTeacher(offering, teacherEmail, teacherStaffNumber);

        session.setCourse(offering.getCourse().getCode());
        session.setRoom(canonicalRoom.getCode());
        session.setCourseOffering(offering);
        session.setRoomEntity(canonicalRoom);
        session.setTeacher(teacher);
        session.setDate(date);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setStatus(status);
    }

    private Room findOrCreateRoom(String roomCode) {
        String code = requireText(roomCode, "Room is required.");
        return roomRepository.findByCodeIgnoreCase(code)
                .orElseGet(() -> {
                    Room room = new Room();
                    room.setCode(code);
                    room.setName(code);
                    room.setCapacity(0);
                    return roomRepository.save(room);
                });
    }

    // Never auto-creates a teacher record for an arbitrary email — doing so used to hand out a
    // claimable, passwordless teacher identity for whatever address was typed into the session
    // form, which anyone could later register a password for and gain full teacher access. The
    // resolved teacher must also already be one of this class's assigned teachers: which teacher
    // can run a session is now a real backend constraint, not just a frontend dropdown convention.
    private Teacher requireClassTeacher(CourseOffering offering, String email, String staffNumber) {
        if (!hasText(email) && !hasText(staffNumber)) {
            throw new ResponseStatusException(BAD_REQUEST, "A teacher is required to create a session.");
        }
        String normalisedEmail = hasText(email) ? email.trim().toLowerCase(Locale.ROOT) : null;
        String normalisedStaffNumber = hasText(staffNumber)
                ? staffNumber.trim().replaceAll("\\s+", "-").toUpperCase(Locale.ROOT)
                : null;

        Optional<Teacher> existing = normalisedEmail != null
                ? teacherRepository.findByEmailIgnoreCase(normalisedEmail)
                        .or(() -> lookupByStaffNumber(normalisedStaffNumber))
                : lookupByStaffNumber(normalisedStaffNumber);
        Teacher teacher = existing.orElseThrow(() -> new ResponseStatusException(BAD_REQUEST,
                "No teacher is registered with that email yet. Ask them to create an account first."));

        if (!offering.isTaughtBy(teacher)) {
            throw new ResponseStatusException(BAD_REQUEST, "Selected teacher is not assigned to this class.");
        }
        if (!"ACTIVE".equals(teacher.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Selected teacher has been deactivated and can't be assigned to a session.");
        }
        return teacher;
    }

    private Optional<Teacher> lookupByStaffNumber(String staffNumber) {
        return staffNumber == null ? Optional.empty() : teacherRepository.findByStaffNumberIgnoreCase(staffNumber);
    }

    // Classes are provisioned explicitly by an Admin (see AdminClassService) — scheduling a session
    // just picks one of the classes that already exist, the same way it can only pick an
    // already-registered teacher. No auto-creation here, for the same reason findOrCreateTeacher
    // stopped auto-creating arbitrary teacher identities.
    private CourseOffering requireActiveOffering(UUID courseOfferingId) {
        if (courseOfferingId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Class is required.");
        }
        CourseOffering offering = courseOfferingRepository.findById(courseOfferingId)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Selected class was not found."));
        if (!OFFERING_STATUS_ACTIVE.equals(offering.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST, "Selected class is archived.");
        }
        return offering;
    }

    private String requireText(String value, String message) {
        if (!hasText(value)) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private ClassroomSessionResponse toResponse(ClassroomSession session) {
        CourseOffering offering = session.getCourseOffering();
        Room room = session.getRoomEntity();
        Teacher teacher = session.getTeacher();
        return new ClassroomSessionResponse(
                session.getId(),
                session.getCourse(),
                session.getRoom(),
                offering == null ? null : offering.getId(),
                offering == null ? null : offering.getOfferingCode(),
                room == null ? null : room.getId(),
                teacher == null ? null : teacher.getId(),
                teacher == null ? null : teacher.getName(),
                teacher == null ? null : teacher.getEmail(),
                session.getDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus()
        );
    }
}
