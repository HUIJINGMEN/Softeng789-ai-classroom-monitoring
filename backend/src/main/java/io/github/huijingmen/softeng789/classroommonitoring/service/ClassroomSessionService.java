package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSchedulePreviewResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomScheduleAvailabilityRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomScheduleAvailabilityResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomScheduleRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ScheduleConflictResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassroomSchedulePlanner.ScheduleDraft;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassroomSchedulePlanner.SessionDraft;
import java.time.Instant;
import java.util.Collection;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ClassroomSessionService {
    // Historical rows already reference this account (it used to be auto-created whenever a
    // session was scheduled with no teacher specified) — those are left alone. What changed is
    // that nothing creates new ones anymore; this constant only remains so AuthService can keep
    // refusing to let the shared identity be claimed.
    public static final String DEFAULT_TEACHER_EMAIL = "unassigned.teacher@auckland.ac.nz";

    private final ClassroomSessionRepository classroomSessionRepository;
    private final ClassroomSchedulePlanner schedulePlanner;
    private final TeacherScopeSupport teacherScopeSupport;

    public ClassroomSessionService(
            ClassroomSessionRepository classroomSessionRepository,
            ClassroomSchedulePlanner schedulePlanner,
            TeacherScopeSupport teacherScopeSupport
    ) {
        this.classroomSessionRepository = classroomSessionRepository;
        this.schedulePlanner = schedulePlanner;
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
        return PageResponse.from(sessions, this::toResponse);
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
        LocalTime startClock = LocalTime.ofInstant(request.startTime(), ZoneOffset.UTC);
        LocalTime endClock = LocalTime.ofInstant(request.endTime(), ZoneOffset.UTC);
        ScheduleDraft draft = schedulePlanner.singleSessionDraft(
                session.getCourseOffering(), request.date(), null, session.getRoomEntity(), session.getTeacher(),
                startClock, endClock
        );
        schedulePlanner.requireNoBlockingConflicts(draft, Set.of());
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional(readOnly = true)
    public ClassroomSchedulePreviewResponse previewSchedule(CreateClassroomScheduleRequest request) {
        return schedulePlanner.preview(request);
    }

    @Transactional(readOnly = true)
    public ClassroomScheduleAvailabilityResponse scheduleAvailability(
            ClassroomScheduleAvailabilityRequest request
    ) {
        return schedulePlanner.availability(request);
    }

    @Transactional
    public List<ClassroomSessionResponse> createSchedule(CreateClassroomScheduleRequest request) {
        ScheduleDraft draft = schedulePlanner.plan(request);
        List<ScheduleConflictResponse> conflicts = schedulePlanner.findConflicts(draft, Set.of());
        boolean hasBlockingConflict = conflicts.stream().anyMatch(conflict -> !conflict.overridable());
        boolean hasUnconfirmedConflict = conflicts.stream().anyMatch(ScheduleConflictResponse::overridable)
                && !Boolean.TRUE.equals(request.allowConflicts());
        if (hasBlockingConflict || hasUnconfirmedConflict) {
            String message = hasBlockingConflict
                    ? "The schedule contains a room, teacher or duplicate-session conflict. Choose an available time and resource."
                    : "The selected room is below the class capacity. Review the warning or confirm the override.";
            throw new ResponseStatusException(CONFLICT, message);
        }

        List<ClassroomSession> sessions = draft.sessions().stream().map(item -> {
            ClassroomSession session = new ClassroomSession();
            session.setCourse(draft.offering().getCourse().getCode());
            session.setRoom(item.room().getCode());
            session.setCourseOffering(draft.offering());
            session.setRoomEntity(item.room());
            session.setTeacher(item.teacher());
            session.setScheduleSeriesId(item.scheduleSeriesId());
            session.setDate(item.date());
            session.setStartTime(schedulePlanner.atUtc(item.date(), item.startTime()));
            session.setEndTime(schedulePlanner.atUtc(item.date(), item.endTime()));
            session.setStatus(SessionStatus.SCHEDULED);
            return session;
        }).toList();
        return classroomSessionRepository.saveAll(sessions).stream()
                .map(this::toResponse)
                .toList();
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
        requireValidSessionTimes(request.date(), request.startTime(), request.endTime());
        requireSameOffering(session, request.courseOfferingId());
        CourseOffering offering = schedulePlanner.requireActiveOffering(request.courseOfferingId());
        Room room = schedulePlanner.requireRoom(request.roomId());
        Teacher teacher = schedulePlanner.requireClassTeacher(
                offering, request.teacherEmail(), request.teacherStaffNumber());
        LocalTime startClock = LocalTime.ofInstant(request.startTime(), ZoneOffset.UTC);
        LocalTime endClock = LocalTime.ofInstant(request.endTime(), ZoneOffset.UTC);
        ScheduleDraft draft = schedulePlanner.singleSessionDraft(
                offering, request.date(), null, room, teacher, startClock, endClock);
        schedulePlanner.requireNoBlockingConflicts(draft, Set.of(session.getId()));
        apply(session, request.courseOfferingId(), request.roomId(), request.teacherEmail(),
                request.teacherStaffNumber(), request.date(), request.startTime(),
                request.endTime(), request.status());
        // Editing one occurrence turns it into an explicit exception. A later recurring edit must
        // not silently overwrite the administrator's one-off decision.
        session.setScheduleSeriesId(null);
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public List<ClassroomSessionResponse> updateFutureSessions(UUID id, UpdateClassroomSessionRequest request) {
        ClassroomSession anchor = findEntity(id);
        requireEditable(anchor);
        if (anchor.getStatus() != SessionStatus.SCHEDULED) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Only a scheduled session can be used to change this and future sessions.");
        }
        requireValidSessionTimes(request.date(), request.startTime(), request.endTime());

        if (anchor.getCourseOffering() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "This historical session is not linked to a class schedule.");
        }
        if (anchor.getScheduleSeriesId() == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This is a one-off session. Only recurring timetable sessions can update a weekly slot.");
        }
        requireSameOffering(anchor, request.courseOfferingId());
        CourseOffering targetOffering = schedulePlanner.requireActiveOffering(request.courseOfferingId());
        Room room = schedulePlanner.requireRoom(request.roomId());
        Teacher teacher = schedulePlanner.requireClassTeacher(
                targetOffering, request.teacherEmail(), request.teacherStaffNumber());
        long dayShift = ChronoUnit.DAYS.between(anchor.getDate(), request.date());
        LocalTime startClock = LocalTime.ofInstant(request.startTime(), ZoneOffset.UTC);
        LocalTime endClock = LocalTime.ofInstant(request.endTime(), ZoneOffset.UTC);

        List<ClassroomSession> future = classroomSessionRepository
                .findByScheduleSeriesIdAndDateGreaterThanEqualAndStatusOrderByDateAscStartTimeAsc(
                        anchor.getScheduleSeriesId(), anchor.getDate(), SessionStatus.SCHEDULED);
        List<SessionDraft> proposed = future.stream().map(session -> {
            LocalDate shiftedDate = session.getDate().plusDays(dayShift);
            return new SessionDraft(
                    shiftedDate, anchor.getScheduleSeriesId(), room, teacher, startClock, endClock);
        }).toList();
        schedulePlanner.requireNoBlockingConflicts(
                new ScheduleDraft(targetOffering, proposed),
                future.stream().map(ClassroomSession::getId).collect(Collectors.toSet()));
        for (ClassroomSession session : future) {
            LocalDate shiftedDate = session.getDate().plusDays(dayShift);
            session.setCourse(targetOffering.getCourse().getCode());
            session.setRoom(room.getCode());
            session.setCourseOffering(targetOffering);
            session.setRoomEntity(room);
            session.setTeacher(teacher);
            session.setDate(shiftedDate);
            session.setStartTime(schedulePlanner.atUtc(shiftedDate, startClock));
            session.setEndTime(schedulePlanner.atUtc(shiftedDate, endClock));
        }
        return classroomSessionRepository.saveAll(future).stream()
                .map(this::toResponse)
                .toList();
    }

    private void requireSameOffering(ClassroomSession session, UUID requestedOfferingId) {
        if (session.getCourseOffering() == null
                || !session.getCourseOffering().getId().equals(requestedOfferingId)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "A scheduled session cannot be moved to a different class.");
        }
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
        requireValidSessionTimes(date, startTime, endTime);
        CourseOffering offering = schedulePlanner.requireActiveOffering(courseOfferingId);
        schedulePlanner.requireAssignedTeacher(offering, "session");
        Room room = schedulePlanner.requireRoom(roomId);
        Teacher teacher = schedulePlanner.requireClassTeacher(offering, teacherEmail, teacherStaffNumber);

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

    private void requireValidSessionTimes(LocalDate date, Instant startTime, Instant endTime) {
        if (!endTime.isAfter(startTime)) {
            throw new ResponseStatusException(BAD_REQUEST, "Session end time must be after start time.");
        }
        LocalDate startDate = LocalDate.ofInstant(startTime, ZoneOffset.UTC);
        LocalDate endDate = LocalDate.ofInstant(endTime, ZoneOffset.UTC);
        if (!date.equals(startDate) || !date.equals(endDate)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Session date must match the start and end time date.");
        }
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
                session.getScheduleSeriesId(),
                session.getDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus()
        );
    }
}
