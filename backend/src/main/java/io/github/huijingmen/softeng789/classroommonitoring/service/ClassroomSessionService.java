package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
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
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
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
    private final TeacherScopeSupport teacherScopeSupport;

    public ClassroomSessionService(
            ClassroomSessionRepository classroomSessionRepository,
            CourseOfferingRepository courseOfferingRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository,
            TeacherScopeSupport teacherScopeSupport
    ) {
        this.classroomSessionRepository = classroomSessionRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.roomRepository = roomRepository;
        this.teacherRepository = teacherRepository;
        this.teacherScopeSupport = teacherScopeSupport;
    }

    // An admin sees every session; a plain teacher only sees sessions for a class they actually
    // teach, the same "own classes only" rule Health Alerts already enforces.
    @Transactional(readOnly = true)
    public List<ClassroomSessionResponse> listSessions(UUID callerId) {
        boolean admin = teacherScopeSupport.isAdmin(teacherScopeSupport.requireCaller(callerId));
        List<ClassroomSession> sessions = admin
                ? classroomSessionRepository.findAllByOrderByDateDescStartTimeDesc()
                : classroomSessionRepository.findByCourseOffering_Teachers_IdOrderByDateDescStartTimeDesc(callerId);
        return sessions.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<ClassroomSessionResponse> listSessions(UUID callerId, int page, int size) {
        return listSessions(callerId, page, size, "");
    }

    @Transactional(readOnly = true)
    public PageResponse<ClassroomSessionResponse> listSessions(
            UUID callerId,
            int page,
            int size,
            String query
    ) {
        boolean admin = teacherScopeSupport.isAdmin(teacherScopeSupport.requireCaller(callerId));
        var pageRequest = PageRequestSupport.create(
                page,
                size,
                Sort.by(Sort.Order.desc("date"), Sort.Order.desc("startTime"), Sort.Order.desc("id"))
        );
        Page<ClassroomSession> sessions = classroomSessionRepository.findAll(
                ClassroomSessionSpecifications.visibleDirectory(callerId, admin, query),
                pageRequest
        );
        List<ClassroomSessionResponse> items = sessions.getContent().stream()
                .map(this::toResponse)
                .toList();
        return PageResponse.from(sessions, items);
    }

    @Transactional(readOnly = true)
    public ClassroomSessionResponse getSession(UUID id) {
        return toResponse(findEntity(id));
    }

    @Transactional
    public ClassroomSessionResponse createSession(CreateClassroomSessionRequest request) {
        ClassroomSession session = new ClassroomSession();
        apply(session, request.courseOfferingId(), request.roomId(), request.teacherEmail(),
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
        apply(session, request.courseOfferingId(), request.roomId(), request.teacherEmail(),
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

    // There's no real face/camera detection behind "a session is happening" — Live Monitoring is a
    // simulated-data prototype — so the only thing that can honestly drive SCHEDULED->ACTIVE and
    // ACTIVE->COMPLETED is the timetable the session was already created with. Runs frequently
    // enough that a class's status flips within moments of its scheduled time without needing a
    // human to press Start/End. CANCELLED and already-COMPLETED sessions are outside both queries,
    // so this can never resurrect or double-transition a terminal session.
    @Scheduled(fixedRate = 30_000)
    @Transactional
    public void autoTransitionSessions() {
        Instant now = Instant.now();
        classroomSessionRepository.findByStatusAndStartTimeLessThanEqual(SessionStatus.SCHEDULED, now)
                .forEach(session -> session.setStatus(SessionStatus.ACTIVE));
        classroomSessionRepository.findByStatusAndEndTimeLessThanEqual(SessionStatus.ACTIVE, now)
                .forEach(session -> session.setStatus(SessionStatus.COMPLETED));
    }

    ClassroomSession findEntity(UUID id) {
        return classroomSessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
    }

    List<ClassroomSession> findEntities(Collection<UUID> ids) {
        List<UUID> requestedIds = ids.stream().distinct().toList();
        Map<UUID, ClassroomSession> sessionsById = classroomSessionRepository.findByIdIn(requestedIds)
                .stream()
                .collect(Collectors.toMap(
                        ClassroomSession::getId,
                        Function.identity(),
                        (first, ignored) -> first,
                        LinkedHashMap::new
                ));
        if (sessionsById.size() != requestedIds.size()) {
            throw new ResponseStatusException(NOT_FOUND, "One or more classroom sessions were not found.");
        }
        return requestedIds.stream().map(sessionsById::get).toList();
    }

    private void apply(
            ClassroomSession session,
            UUID courseOfferingId,
            UUID roomId,
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
        Room room = requireRoom(roomId);
        Teacher teacher = requireClassTeacher(offering, teacherEmail, teacherStaffNumber);

        session.setCourse(offering.getCourse().getCode());
        session.setRoom(room.getCode());
        session.setCourseOffering(offering);
        session.setRoomEntity(room);
        session.setTeacher(teacher);
        session.setDate(date);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setStatus(status);
    }

    // Rooms are provisioned explicitly by an Admin now (see RoomService), scoped to a campus —
    // scheduling a session just picks one of the rooms that already exists, the same reason
    // requireActiveOffering/requireClassTeacher below don't auto-create their targets either.
    private Room requireRoom(UUID roomId) {
        if (roomId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Room is required.");
        }
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Selected room was not found."));
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
                room == null ? null : room.getCampus().getId(),
                room == null ? null : room.getCampus().getName(),
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
