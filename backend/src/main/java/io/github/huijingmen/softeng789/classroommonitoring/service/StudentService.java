package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class StudentService {
    private static final TypeReference<List<FaceEnrollmentCaptureMetadata>> CAPTURE_METADATA_LIST =
            new TypeReference<>() {
            };

    private final StudentRepository studentRepository;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final ObjectMapper objectMapper;
    private final Path faceEnrollmentRoot;

    public StudentService(
            StudentRepository studentRepository,
            FaceEnrollmentRepository faceEnrollmentRepository,
            CourseRepository courseRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            ObjectMapper objectMapper,
            @Value("${app.storage.face-enrollment-dir:../data/face-enrollment}") String faceEnrollmentRoot
    ) {
        this.studentRepository = studentRepository;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.courseRepository = courseRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.objectMapper = objectMapper;
        this.faceEnrollmentRoot = Path.of(faceEnrollmentRoot);
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> listStudents() {
        return studentRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StudentResponse getStudent(UUID id) {
        return toResponse(findEntity(id));
    }

    @Transactional
    public StudentResponse createStudent(CreateStudentRequest request) {
        requireUniqueStudentNumber(request.studentNumber(), null);
        requireUniqueUniversityEmail(request.universityEmail(), null);
        List<String> courses = normaliseCourses(request.course(), request.courses());

        Student student = new Student();
        apply(student, request.studentNumber(), request.universityEmail(), request.firstName(),
                request.lastName(), courses.get(0), request.seat(), request.programme(),
                request.consentGiven());
        student = studentRepository.save(student);
        replaceEnrollments(student, courses);
        return toResponse(student);
    }

    @Transactional
    public StudentResponse updateStudent(UUID id, UpdateStudentRequest request) {
        Student student = findEntity(id);
        requireUniqueStudentNumber(request.studentNumber(), id);
        requireUniqueUniversityEmail(request.universityEmail(), id);
        List<String> courses = normaliseCourses(request.course(), request.courses());

        apply(student, request.studentNumber(), request.universityEmail(), request.firstName(),
                request.lastName(), courses.get(0), request.seat(), request.programme(),
                request.consentGiven());
        student = studentRepository.save(student);
        replaceEnrollments(student, courses);
        return toResponse(student);
    }

    Student findEntity(UUID id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
    }

    Student save(Student student) {
        return studentRepository.save(student);
    }

    StudentResponse toResponse(Student student) {
        String photoUrl = faceEnrollmentRepository.findByStudent_Id(student.getId())
                .map(FaceEnrollment::getImagePath)
                .map(path -> "/api/students/" + student.getId() + "/face-enrollment/photo")
                .orElse(null);
        List<String> courses = enrolledCourseCodes(student);

        return new StudentResponse(
                student.getId(),
                student.getStudentNumber(),
                student.getUniversityEmail(),
                student.getFirstName(),
                student.getLastName(),
                student.getCourse(),
                courses,
                student.getSeat(),
                student.getProgramme(),
                student.isConsentGiven(),
                student.getFaceEnrollmentStatus(),
                photoUrl,
                faceEnrollmentCaptures(student.getId()),
                student.getCreatedAt(),
                student.getUpdatedAt()
        );
    }

    private void apply(
            Student student,
            String studentNumber,
            String universityEmail,
            String firstName,
            String lastName,
            String course,
            String seat,
            String programme,
            Boolean consentGiven
    ) {
        student.setStudentNumber(studentNumber.trim());
        student.setUniversityEmail(universityEmail.trim());
        student.setFirstName(firstName.trim());
        student.setLastName(lastName.trim());
        student.setCourse(course.trim());
        student.setSeat(seat.trim());
        student.setProgramme(programme.trim());
        student.setConsentGiven(Boolean.TRUE.equals(consentGiven));
    }

    private List<String> normaliseCourses(String primaryCourse, List<String> requestedCourses) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        if (primaryCourse != null && !primaryCourse.isBlank()) {
            values.add(normaliseCourseCode(primaryCourse));
        }
        if (requestedCourses != null) {
            requestedCourses.stream()
                    .filter(course -> course != null && !course.isBlank())
                    .map(this::normaliseCourseCode)
                    .forEach(values::add);
        }
        if (values.isEmpty()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "At least one enrolled course is required.");
        }
        return new ArrayList<>(values);
    }

    private String normaliseCourseCode(String course) {
        return course.trim().replaceAll("\\s+", " ").toUpperCase();
    }

    private void replaceEnrollments(Student student, List<String> courseCodes) {
        courseEnrollmentRepository.deleteByStudent_Id(student.getId());
        courseCodes.stream()
                .map(this::findOrCreateCourse)
                .map(course -> enrollment(student, course))
                .forEach(courseEnrollmentRepository::save);
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

    private CourseEnrollment enrollment(Student student, Course course) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourse(course);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        return enrollment;
    }

    private List<String> enrolledCourseCodes(Student student) {
        List<String> courses = courseEnrollmentRepository.findByStudent_IdOrderByCourse_CodeAsc(student.getId())
                .stream()
                .filter(enrollment -> enrollment.getStatus() == CourseEnrollment.EnrollmentStatus.ACTIVE)
                .map(enrollment -> enrollment.getCourse().getCode())
                .sorted(Comparator.comparing(course -> course.equalsIgnoreCase(student.getCourse()) ? 0 : 1))
                .toList();
        return courses.isEmpty() ? List.of(student.getCourse()) : courses;
    }

    private List<FaceEnrollmentCaptureResponse> faceEnrollmentCaptures(UUID studentId) {
        Path metadataPath = faceEnrollmentRoot.resolve(studentId.toString()).resolve("captures.json").normalize();
        if (!Files.isRegularFile(metadataPath)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(metadataPath.toFile(), CAPTURE_METADATA_LIST)
                    .stream()
                    .map(capture -> new FaceEnrollmentCaptureResponse(
                            safePose(capture.pose()),
                            capture.label(),
                            "/api/students/" + studentId + "/face-enrollment/captures/"
                                    + safePose(capture.pose()) + "/photo",
                            capture.qualityScore(),
                            capture.poseScore(),
                            capture.capturedAt(),
                            Boolean.TRUE.equals(capture.optional())
                    ))
                    .toList();
        } catch (IOException ex) {
            return List.of();
        }
    }

    private String safePose(String pose) {
        if (pose == null || pose.isBlank()) {
            return "unknown";
        }
        String safe = pose.trim().toLowerCase().replaceAll("[^a-z0-9_-]", "_");
        return safe.isBlank() ? "unknown" : safe;
    }

    private void requireUniqueStudentNumber(String studentNumber, UUID currentId) {
        studentRepository.findByStudentNumber(studentNumber.trim()).ifPresent(existing -> {
            if (!existing.getId().equals(currentId)) {
                throw new ResponseStatusException(CONFLICT, "Student number already exists.");
            }
        });
    }

    private void requireUniqueUniversityEmail(String universityEmail, UUID currentId) {
        studentRepository.findByUniversityEmailIgnoreCase(universityEmail.trim()).ifPresent(existing -> {
            if (!existing.getId().equals(currentId)) {
                throw new ResponseStatusException(CONFLICT, "University email already exists.");
            }
        });
    }
}
