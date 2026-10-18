package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomScheduleAvailabilityRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomScheduleAvailabilityResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSchedulePreviewResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomScheduleSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomScheduleRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ScheduleAvailabilityGroupResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ScheduleConflictResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

/**
 * Resolves timetable requests into validated domain objects and detects resource conflicts.
 * Persistence and session lifecycle transitions remain in {@link ClassroomSessionService}.
 */
@Service
class ClassroomSchedulePlanner {
    private static final String OFFERING_STATUS_ACTIVE = "ACTIVE";

    private final ClassroomSessionRepository classroomSessionRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final RoomRepository roomRepository;
    private final TeacherRepository teacherRepository;

    ClassroomSchedulePlanner(
            ClassroomSessionRepository classroomSessionRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            CourseOfferingRepository courseOfferingRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository
    ) {
        this.classroomSessionRepository = classroomSessionRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.roomRepository = roomRepository;
        this.teacherRepository = teacherRepository;
    }

    ClassroomSchedulePreviewResponse preview(CreateClassroomScheduleRequest request) {
        ScheduleDraft draft = plan(request);
        return new ClassroomSchedulePreviewResponse(draft.dates(), findConflicts(draft, Set.of()));
    }

    ClassroomScheduleAvailabilityResponse availability(ClassroomScheduleAvailabilityRequest request) {
        requireActiveOffering(request.courseOfferingId());
        if (request.groups().stream().map(group -> group.key().trim()).distinct().count() != request.groups().size()) {
            throw new ResponseStatusException(BAD_REQUEST, "Availability group keys must be unique.");
        }

        request.groups().forEach(group -> group.slots().forEach(slot -> {
            if (!slot.endTime().isAfter(slot.startTime())) {
                throw new ResponseStatusException(BAD_REQUEST,
                        "Session end time must be after start time on " + slot.date() + ".");
            }
        }));
        List<LocalDate> dates = request.groups().stream()
                .flatMap(group -> group.slots().stream())
                .map(slot -> slot.date())
                .distinct()
                .toList();
        List<ClassroomSession> existing = classroomSessionRepository.findByDateInAndStatusNot(
                dates, SessionStatus.CANCELLED).stream()
                .filter(session -> !request.ignoredSessionIds().contains(session.getId()))
                .toList();

        List<ScheduleAvailabilityGroupResponse> groups = request.groups().stream().map(group -> {
            LinkedHashSet<LocalDate> courseConflicts = new LinkedHashSet<>();
            Map<UUID, LinkedHashSet<LocalDate>> roomConflicts = new LinkedHashMap<>();
            Map<UUID, LinkedHashSet<LocalDate>> teacherConflicts = new LinkedHashMap<>();
            group.slots().forEach(slot -> {
                Instant start = SessionClock.instant(slot.date(), slot.startTime());
                Instant end = SessionClock.instant(slot.date(), slot.endTime());
                existing.stream()
                        .filter(session -> session.getDate().equals(slot.date())
                                && session.getStartTime().isBefore(end)
                                && session.getEndTime().isAfter(start))
                        .forEach(session -> collectAvailabilityConflict(
                                request.courseOfferingId(), slot.date(), session,
                                courseConflicts, roomConflicts, teacherConflicts));
            });
            return new ScheduleAvailabilityGroupResponse(
                    group.key().trim(),
                    courseConflicts.stream().sorted().toList(),
                    copyConflictDates(roomConflicts),
                    copyConflictDates(teacherConflicts)
            );
        }).toList();
        return new ClassroomScheduleAvailabilityResponse(groups);
    }

    private void collectAvailabilityConflict(
            UUID courseOfferingId,
            LocalDate date,
            ClassroomSession session,
            Set<LocalDate> courseConflicts,
            Map<UUID, LinkedHashSet<LocalDate>> roomConflicts,
            Map<UUID, LinkedHashSet<LocalDate>> teacherConflicts
    ) {
        if (session.getCourseOffering() != null
                && session.getCourseOffering().getId().equals(courseOfferingId)) {
            courseConflicts.add(date);
        }
        if (session.getRoomEntity() != null) {
            roomConflicts.computeIfAbsent(session.getRoomEntity().getId(), ignored -> new LinkedHashSet<>())
                    .add(date);
        }
        if (session.getTeacher() != null) {
            teacherConflicts.computeIfAbsent(session.getTeacher().getId(), ignored -> new LinkedHashSet<>())
                    .add(date);
        }
    }

    ScheduleDraft plan(CreateClassroomScheduleRequest request) {
        CourseOffering offering = requireActiveOffering(request.courseOfferingId());
        requireAssignedTeacher(offering, "schedule");
        Map<UUID, Room> rooms = new LinkedHashMap<>();
        Map<String, Teacher> teachers = new LinkedHashMap<>();
        List<SessionDraft> sessions = request.sessions().stream().map(item -> {
            if (!item.endTime().isAfter(item.startTime())) {
                throw new ResponseStatusException(BAD_REQUEST,
                        "Session end time must be after start time on " + item.date() + ".");
            }
            Room room = rooms.computeIfAbsent(item.roomId(), this::requireRoom);
            Teacher teacher = teachers.computeIfAbsent(teacherLookupKey(item),
                    ignored -> requireClassTeacher(offering, item.teacherEmail(), item.teacherStaffNumber()));
            return new SessionDraft(
                    item.date(), item.scheduleSeriesId(), room, teacher, item.startTime(), item.endTime());
        }).sorted(Comparator.comparing(SessionDraft::date).thenComparing(SessionDraft::startTime)).toList();
        return new ScheduleDraft(offering, sessions);
    }

    ScheduleDraft singleSessionDraft(
            CourseOffering offering,
            LocalDate date,
            UUID scheduleSeriesId,
            Room room,
            Teacher teacher,
            LocalTime startTime,
            LocalTime endTime
    ) {
        return new ScheduleDraft(offering,
                List.of(new SessionDraft(date, scheduleSeriesId, room, teacher, startTime, endTime)));
    }

    List<ScheduleConflictResponse> findConflicts(ScheduleDraft draft, Set<UUID> ignoredSessionIds) {
        Map<String, ScheduleConflictResponse> conflicts = new LinkedHashMap<>();
        List<ClassroomSession> existingSessions = classroomSessionRepository.findByDateInAndStatusNot(
                draft.dates(), SessionStatus.CANCELLED).stream()
                .filter(session -> !ignoredSessionIds.contains(session.getId()))
                .toList();

        for (int index = 0; index < draft.sessions().size(); index++) {
            SessionDraft item = draft.sessions().get(index);
            collectInternalConflicts(draft.sessions(), index, item, conflicts);
            collectExistingConflicts(draft.offering(), existingSessions, item, conflicts);
        }
        collectCapacityConflicts(draft, conflicts);
        return List.copyOf(conflicts.values());
    }

    private void collectInternalConflicts(
            List<SessionDraft> sessions,
            int index,
            SessionDraft item,
            Map<String, ScheduleConflictResponse> conflicts
    ) {
        for (int comparisonIndex = 0; comparisonIndex < index; comparisonIndex++) {
            SessionDraft other = sessions.get(comparisonIndex);
            if (!overlaps(item, other)) {
                continue;
            }
            if (item.startTime().equals(other.startTime()) && item.endTime().equals(other.endTime())) {
                addConflict(conflicts, new ScheduleConflictResponse(
                        "DUPLICATE", item.date(), null,
                        "The weekly template generates the same session twice at " + item.startTime() + ".", false));
                continue;
            }
            addConflict(conflicts, new ScheduleConflictResponse(
                    "COURSE", item.date(), null,
                    "This class has two overlapping sessions in the timetable.", false));
            if (item.room().getId().equals(other.room().getId())) {
                addConflict(conflicts, new ScheduleConflictResponse(
                        "ROOM", item.date(), null,
                        item.room().getCode() + " is assigned to two overlapping sessions in this timetable.", false));
            }
            if (item.teacher().getId().equals(other.teacher().getId())) {
                addConflict(conflicts, new ScheduleConflictResponse(
                        "TEACHER", item.date(), null,
                        item.teacher().getName() + " is assigned to two overlapping sessions in this timetable.", false));
            }
        }
    }

    private boolean overlaps(SessionDraft item, SessionDraft other) {
        return item.date().equals(other.date())
                && item.startTime().isBefore(other.endTime())
                && item.endTime().isAfter(other.startTime());
    }

    private void collectExistingConflicts(
            CourseOffering offering,
            List<ClassroomSession> existingSessions,
            SessionDraft item,
            Map<String, ScheduleConflictResponse> conflicts
    ) {
        Instant start = SessionClock.instant(item.date(), item.startTime());
        Instant end = SessionClock.instant(item.date(), item.endTime());
        existingSessions.stream()
                .filter(existing -> existing.getDate().equals(item.date())
                        && existing.getStartTime().isBefore(end)
                        && existing.getEndTime().isAfter(start))
                .forEach(existing -> collectExistingConflict(offering, item, start, end, existing, conflicts));
    }

    private void collectExistingConflict(
            CourseOffering offering,
            SessionDraft item,
            Instant start,
            Instant end,
            ClassroomSession existing,
            Map<String, ScheduleConflictResponse> conflicts
    ) {
        boolean sameOffering = existing.getCourseOffering() != null
                && existing.getCourseOffering().getId().equals(offering.getId());
        if (sameOffering && existing.getStartTime().equals(start) && existing.getEndTime().equals(end)) {
            addConflict(conflicts, new ScheduleConflictResponse(
                    "DUPLICATE", item.date(), existing.getId(),
                    "This class already has a session at " + item.startTime() + ".", false));
            return;
        }
        if (sameOffering) {
            addConflict(conflicts, new ScheduleConflictResponse(
                    "COURSE", item.date(), existing.getId(),
                    "This class already has an overlapping session at this time.", false));
        }
        if (existing.getRoomEntity() != null
                && existing.getRoomEntity().getId().equals(item.room().getId())) {
            addConflict(conflicts, new ScheduleConflictResponse(
                    "ROOM", item.date(), existing.getId(),
                    item.room().getCode() + " is already booked for " + existing.getCourse() + ".", false));
        }
        if (existing.getTeacher() != null
                && existing.getTeacher().getId().equals(item.teacher().getId())) {
            addConflict(conflicts, new ScheduleConflictResponse(
                    "TEACHER", item.date(), existing.getId(),
                    item.teacher().getName() + " is already teaching " + existing.getCourse() + ".", false));
        }
    }

    private void collectCapacityConflicts(
            ScheduleDraft draft,
            Map<String, ScheduleConflictResponse> conflicts
    ) {
        long studentCount = courseEnrollmentRepository.countByCourseOffering_IdAndStatus(
                draft.offering().getId(), EnrollmentStatus.ACTIVE);
        draft.sessions().stream().map(SessionDraft::room).distinct().forEach(room -> {
            if (room.getCapacity() > 0 && studentCount > room.getCapacity()) {
                addConflict(conflicts, new ScheduleConflictResponse(
                        "CAPACITY", null, null,
                        room.getCode() + " holds " + room.getCapacity()
                                + " people, but this class currently has " + studentCount + " students.", true));
            }
        });
    }

    void requireNoBlockingConflicts(ScheduleDraft draft, Set<UUID> ignoredSessionIds) {
        findConflicts(draft, ignoredSessionIds).stream()
                .filter(conflict -> !conflict.overridable())
                .findFirst()
                .ifPresent(conflict -> {
                    throw new ResponseStatusException(CONFLICT, conflict.message());
                });
    }

    CourseOffering requireActiveOffering(UUID courseOfferingId) {
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

    Room requireRoom(UUID roomId) {
        if (roomId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Room is required.");
        }
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Selected room was not found."));
    }

    Teacher requireClassTeacher(CourseOffering offering, String email, String staffNumber) {
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

    void requireAssignedTeacher(CourseOffering offering, String target) {
        if (offering.getTeachers().isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This class has no assigned teacher. Please assign a teacher before creating the " + target + ".");
        }
    }

    private Optional<Teacher> lookupByStaffNumber(String staffNumber) {
        return staffNumber == null ? Optional.empty() : teacherRepository.findByStaffNumberIgnoreCase(staffNumber);
    }

    private String teacherLookupKey(ClassroomScheduleSessionRequest item) {
        String email = Optional.ofNullable(item.teacherEmail()).orElse("").trim().toLowerCase(Locale.ROOT);
        String staffNumber = Optional.ofNullable(item.teacherStaffNumber()).orElse("").trim().toUpperCase(Locale.ROOT);
        return email + ":" + staffNumber;
    }

    private Map<UUID, List<LocalDate>> copyConflictDates(Map<UUID, LinkedHashSet<LocalDate>> conflicts) {
        Map<UUID, List<LocalDate>> result = new LinkedHashMap<>();
        conflicts.forEach((id, dates) -> result.put(id, dates.stream().sorted().toList()));
        return result;
    }

    private void addConflict(Map<String, ScheduleConflictResponse> conflicts, ScheduleConflictResponse conflict) {
        String key = conflict.type() + ":" + conflict.date() + ":" + conflict.existingSessionId()
                + ":" + conflict.message();
        conflicts.putIfAbsent(key, conflict);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    record ScheduleDraft(CourseOffering offering, List<SessionDraft> sessions) {
        List<LocalDate> dates() {
            return sessions.stream().map(SessionDraft::date).distinct().toList();
        }
    }

    record SessionDraft(
            LocalDate date,
            UUID scheduleSeriesId,
            Room room,
            Teacher teacher,
            LocalTime startTime,
            LocalTime endTime
    ) {
    }
}
