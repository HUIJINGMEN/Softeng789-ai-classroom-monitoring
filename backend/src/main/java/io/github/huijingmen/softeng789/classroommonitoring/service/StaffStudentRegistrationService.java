package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffCreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffCreateStudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
public class StaffStudentRegistrationService {
    private final StudentRepository studentRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final FaceEnrollmentService faceEnrollmentService;
    private final TeacherScopeSupport access;

    public StaffStudentRegistrationService(
            StudentRepository studentRepository,
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository enrollmentRepository,
            FaceEnrollmentService faceEnrollmentService,
            TeacherScopeSupport access
    ) {
        this.studentRepository = studentRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.faceEnrollmentService = faceEnrollmentService;
        this.access = access;
    }

    @Transactional
    public StaffCreateStudentResponse create(
            StaffCreateStudentRequest request,
            String captureMetadata,
            List<MultipartFile> captureImages,
            UUID callerId
    ) {
        Teacher caller = access.requireCaller(callerId);
        String number = request.studentNumber().trim();
        String email = request.universityEmail().trim();
        if (studentRepository.findByStudentNumberIgnoreCase(number).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That student ID already exists.");
        }
        if (studentRepository.findByUniversityEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That university email already exists.");
        }

        Set<UUID> requestedIds = Set.copyOf(request.classOfferingIds());
        List<CourseOffering> offerings = courseOfferingRepository.findAllById(requestedIds);
        boolean valid = offerings.size() == requestedIds.size()
                && offerings.stream().allMatch(offering -> "ACTIVE".equals(offering.getStatus()));
        if (!valid) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more selected classes are unavailable.");
        }
        offerings.forEach(offering -> access.assertCanAccessOffering(offering, caller));

        boolean reviewRequired = !access.isAdmin(caller);
        Student student = new Student();
        student.setStudentNumber(number);
        student.setUniversityEmail(email);
        student.setFirstName(request.firstName().trim());
        student.setLastName(request.lastName().trim());
        student.setCourse(offerings.get(0).getCourse().getCode());
        student.setSeat("Unassigned");
        student.setProgramme(request.programme() == null ? "" : request.programme().trim());
        student.setConsentGiven(true);
        student.setLevel(request.level());
        student.setApprovalStatus(reviewRequired ? "PENDING" : "APPROVED");
        student = studentRepository.save(student);

        CourseEnrollment.EnrollmentStatus enrollmentStatus = reviewRequired
                ? CourseEnrollment.EnrollmentStatus.PENDING
                : CourseEnrollment.EnrollmentStatus.ACTIVE;
        for (CourseOffering offering : offerings) {
            CourseEnrollment enrollment = new CourseEnrollment();
            enrollment.setStudent(student);
            enrollment.setCourseOffering(offering);
            enrollment.setStatus(enrollmentStatus);
            enrollmentRepository.save(enrollment);
        }

        var face = faceEnrollmentService.enrolFaceCaptures(student.getId(), captureMetadata, captureImages);
        return new StaffCreateStudentResponse(
                student.getId(), student.getFullName(), student.getApprovalStatus(), face.status(), reviewRequired);
    }
}
