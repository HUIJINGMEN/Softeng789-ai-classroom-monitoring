package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentRecognitionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class StudentRecognitionService {
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final StudentRecognitionGateway recognitionGateway;
    private final TeacherScopeSupport access;

    public StudentRecognitionService(
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            StudentRecognitionGateway recognitionGateway,
            TeacherScopeSupport access
    ) {
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.recognitionGateway = recognitionGateway;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public StudentRecognitionResponse recognize(
            UUID courseOfferingId,
            MultipartFile photo,
            UUID callerId
    ) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = courseOfferingRepository.findById(courseOfferingId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        access.assertCanAccessOffering(offering, caller);

        if (photo == null || photo.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Take or choose a photo first.");
        }
        if (photo.getContentType() != null && !photo.getContentType().startsWith("image/")) {
            throw new ResponseStatusException(BAD_REQUEST, "The recognition upload must be an image.");
        }

        List<Student> candidates = courseEnrollmentRepository
                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE)
                .stream()
                .map(CourseEnrollment::getStudent)
                .filter(student -> "ACTIVE".equals(student.getStatus()))
                .toList();
        if (candidates.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "This class has no active students to recognise.");
        }

        byte[] bytes;
        try {
            bytes = photo.getBytes();
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not read the uploaded photo.", ex);
        }
        StudentRecognitionGateway.RecognitionMatch match = recognitionGateway.recognize(bytes, candidates);
        Student student = candidates.stream()
                .filter(candidate -> candidate.getId().equals(match.studentId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        BAD_REQUEST, "The recognition result is not enrolled in this class."));

        return new StudentRecognitionResponse(
                student.getId(),
                student.getFullName(),
                student.getStudentNumber(),
                match.confidence(),
                match.mode()
        );
    }
}
