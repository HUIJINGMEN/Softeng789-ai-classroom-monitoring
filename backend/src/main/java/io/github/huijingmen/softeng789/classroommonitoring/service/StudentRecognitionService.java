package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentRecognitionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
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
    private final ImageUploadService imageUploadService;
    private final TransactionTemplate readTransaction;

    public StudentRecognitionService(
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            StudentRecognitionGateway recognitionGateway,
            TeacherScopeSupport access,
            ImageUploadService imageUploadService,
            PlatformTransactionManager transactionManager
    ) {
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.recognitionGateway = recognitionGateway;
        this.access = access;
        this.imageUploadService = imageUploadService;
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public StudentRecognitionResponse recognize(
            UUID courseOfferingId,
            MultipartFile photo,
            UUID callerId
    ) {
        List<StudentRecognitionGateway.RecognitionCandidate> candidates = requireTransactionResult(
                readTransaction.execute(status -> loadCandidates(courseOfferingId, callerId)));
        byte[] bytes = imageUploadService.normaliseToJpeg(photo);
        StudentRecognitionGateway.RecognitionMatch match = recognitionGateway.recognize(bytes, candidates);
        StudentRecognitionGateway.RecognitionCandidate student = candidates.stream()
                .filter(candidate -> candidate.studentId().equals(match.studentId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        BAD_REQUEST, "The recognition result is not enrolled in this class."));

        return new StudentRecognitionResponse(
                student.studentId(),
                student.fullName(),
                student.studentNumber(),
                match.confidence(),
                match.mode()
        );
    }

    private List<StudentRecognitionGateway.RecognitionCandidate> loadCandidates(
            UUID courseOfferingId,
            UUID callerId
    ) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = courseOfferingRepository.findById(courseOfferingId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        access.assertCanAccessOffering(offering, caller);

        List<StudentRecognitionGateway.RecognitionCandidate> candidates = courseEnrollmentRepository
                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE)
                .stream()
                .map(CourseEnrollment::getStudent)
                .filter(student -> "ACTIVE".equals(student.getStatus()))
                .map(student -> new StudentRecognitionGateway.RecognitionCandidate(
                        student.getId(), student.getFullName(), student.getStudentNumber()))
                .toList();
        if (candidates.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "This class has no active students to recognise.");
        }
        return candidates;
    }

    private <T> T requireTransactionResult(T value) {
        if (value == null) {
            throw new IllegalStateException("The recognition transaction did not return a result.");
        }
        return value;
    }
}
