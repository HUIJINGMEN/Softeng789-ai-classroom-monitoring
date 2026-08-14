package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ClassroomSessionService {
    private static final String DEFAULT_TEACHER_EMAIL = "unassigned.teacher@auckland.ac.nz";
    private static final String DEFAULT_TEACHER_NAME = "Unassigned Teacher";
    private static final String DEFAULT_TEACHER_STAFF_NUMBER = "UNASSIGNED";

    private final ClassroomSessionRepository classroomSessionRepository;
    private final CourseRepository courseRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final RoomRepository roomRepository;
    private final TeacherRepository teacherRepository;

    public ClassroomSessionService(
            ClassroomSessionRepository classroomSessionRepository,
            CourseRepository courseRepository,
            CourseOfferingRepository courseOfferingRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository
    ) {
        this.classroomSessionRepository = classroomSessionRepository;
        this.courseRepository = courseRepository;
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
        apply(session, request.course(), request.room(), request.teacherName(), request.teacherEmail(),
                request.teacherStaffNumber(), request.date(), request.startTime(),
                request.endTime(), request.status() == null ? SessionStatus.SCHEDULED : request.status());
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse updateSession(UUID id, UpdateClassroomSessionRequest request) {
        ClassroomSession session = findEntity(id);
        apply(session, request.course(), request.room(), request.teacherName(), request.teacherEmail(),
                request.teacherStaffNumber(), request.date(), request.startTime(),
                request.endTime(), request.status());
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse startSession(UUID id) {
        ClassroomSession session = findEntity(id);
        session.setStatus(SessionStatus.ACTIVE);
        return toResponse(classroomSessionRepository.save(session));
    }

    @Transactional
    public ClassroomSessionResponse endSession(UUID id) {
        ClassroomSession session = findEntity(id);
        session.setStatus(SessionStatus.COMPLETED);
        return toResponse(classroomSessionRepository.save(session));
    }

    ClassroomSession findEntity(UUID id) {
        return classroomSessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
    }

    private void apply(
            ClassroomSession session,
            String course,
            String room,
            String teacherName,
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
        Course canonicalCourse = findOrCreateCourse(normaliseCourseCode(course));
        Room canonicalRoom = findOrCreateRoom(room);
        Teacher teacher = findOrCreateTeacher(teacherName, teacherEmail, teacherStaffNumber);
        CourseOffering offering = findOrCreateOffering(canonicalCourse, date, teacher);

        session.setCourse(canonicalCourse.getCode());
        session.setRoom(canonicalRoom.getCode());
        session.setCourseOffering(offering);
        session.setRoomEntity(canonicalRoom);
        session.setTeacher(teacher);
        session.setDate(date);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setStatus(status);
    }

    private Course findOrCreateCourse(String courseCode) {
        return courseRepository.findByCodeIgnoreCase(courseCode)
                .orElseGet(() -> {
                    Course course = new Course();
                    course.setCode(courseCode);
                    course.setName(courseCode);
                    return courseRepository.save(course);
                });
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

    private Teacher findOrCreateTeacher(String name, String email, String staffNumber) {
        String normalisedEmail = hasText(email) ? email.trim().toLowerCase(Locale.ROOT) : DEFAULT_TEACHER_EMAIL;
        String normalisedName = hasText(name) ? name.trim().replaceAll("\\s+", " ") : DEFAULT_TEACHER_NAME;
        String normalisedStaffNumber = hasText(staffNumber)
                ? staffNumber.trim().replaceAll("\\s+", "-").toUpperCase(Locale.ROOT)
                : staffNumberFromEmail(normalisedEmail);

        return teacherRepository.findByEmailIgnoreCase(normalisedEmail)
                .or(() -> teacherRepository.findByStaffNumberIgnoreCase(normalisedStaffNumber))
                .orElseGet(() -> {
                    Teacher teacher = new Teacher();
                    teacher.setEmail(normalisedEmail);
                    teacher.setName(normalisedName);
                    teacher.setStaffNumber(normalisedStaffNumber);
                    return teacherRepository.save(teacher);
                });
    }

    private CourseOffering findOrCreateOffering(Course course, java.time.LocalDate date, Teacher teacher) {
        String academicTerm = date.getYear() + " Teaching Year";
        String offeringCode = course.getCode() + " " + date.getYear();
        return courseOfferingRepository.findByOfferingCodeIgnoreCase(offeringCode)
                .orElseGet(() -> {
                    CourseOffering offering = new CourseOffering();
                    offering.setCourse(course);
                    offering.setOfferingCode(offeringCode);
                    offering.setAcademicTerm(academicTerm);
                    offering.setTeacher(teacher);
                    return courseOfferingRepository.save(offering);
                });
    }

    private String normaliseCourseCode(String course) {
        return requireText(course, "Course is required.").toUpperCase(Locale.ROOT);
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

    private String staffNumberFromEmail(String email) {
        if (DEFAULT_TEACHER_EMAIL.equals(email)) {
            return DEFAULT_TEACHER_STAFF_NUMBER;
        }
        String localPart = email.split("@", 2)[0]
                .replaceAll("[^A-Za-z0-9]+", "-")
                .replaceAll("(^-|-$)", "")
                .toUpperCase(Locale.ROOT);
        return localPart.isBlank() ? DEFAULT_TEACHER_STAFF_NUMBER : "STAFF-" + localPart;
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
