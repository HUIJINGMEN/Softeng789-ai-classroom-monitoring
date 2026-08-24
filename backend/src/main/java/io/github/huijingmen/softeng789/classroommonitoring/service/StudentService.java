package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class StudentService {
    private final StudentRepository studentRepository;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final CourseLookupService courseLookupService;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final FaceEnrollmentStorageService faceEnrollmentStorageService;

    public StudentService(
            StudentRepository studentRepository,
            FaceEnrollmentRepository faceEnrollmentRepository,
            CourseLookupService courseLookupService,
            CourseEnrollmentRepository courseEnrollmentRepository,
            FaceEnrollmentStorageService faceEnrollmentStorageService
    ) {
        this.studentRepository = studentRepository;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.courseLookupService = courseLookupService;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.faceEnrollmentStorageService = faceEnrollmentStorageService;
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
                .map(path -> faceEnrollmentStorageService.photoUrl(student.getId()))
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
            values.add(courseLookupService.normaliseCourseCode(primaryCourse));
        }
        if (requestedCourses != null) {
            requestedCourses.stream()
                    .filter(course -> course != null && !course.isBlank())
                    .map(courseLookupService::normaliseCourseCode)
                    .forEach(values::add);
        }
        if (values.isEmpty()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "At least one enrolled course is required.");
        }
        return new ArrayList<>(values);
    }

    private void replaceEnrollments(Student student, List<String> courseCodes) {
        courseEnrollmentRepository.deleteByStudent_Id(student.getId());
        courseCodes.stream()
                .map(courseLookupService::findOrCreateCourse)
                .map(course -> enrollment(student, course))
                .forEach(courseEnrollmentRepository::save);
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
        return faceEnrollmentStorageService.listCaptures(studentId);
    }

    private void requireUniqueStudentNumber(String studentNumber, UUID currentId) {
        studentRepository.findByStudentNumberIgnoreCase(studentNumber.trim()).ifPresent(existing -> {
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
