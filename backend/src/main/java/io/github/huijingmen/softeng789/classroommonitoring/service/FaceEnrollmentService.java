package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FaceEnrollmentService {
    private final StudentService studentService;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final FaceEnrollmentGateway faceEnrollmentGateway;
    private final FaceRegistrationVerifier registrationVerifier;
    private final FaceEnrollmentStorageService storageService;
    private final ImageUploadService imageUploadService;
    private final TransactionTemplate transactionTemplate;

    public FaceEnrollmentService(
            StudentService studentService,
            FaceEnrollmentRepository faceEnrollmentRepository,
            FaceEnrollmentGateway faceEnrollmentGateway,
            FaceRegistrationVerifier registrationVerifier,
            FaceEnrollmentStorageService storageService,
            ImageUploadService imageUploadService,
            PlatformTransactionManager transactionManager
    ) {
        this.studentService = studentService;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.faceEnrollmentGateway = faceEnrollmentGateway;
        this.registrationVerifier = registrationVerifier;
        this.storageService = storageService;
        this.imageUploadService = imageUploadService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /** Saves an already AI-verified set as part of the caller's registration transaction. */
    public FaceEnrollmentResponse persistVerifiedCaptures(
            UUID studentId,
            FaceRegistrationVerifier.VerifiedCaptureSet verified
    ) {
        Student student = studentService.findEntity(studentId);
        requireConsent(student);

        FaceEnrollmentStorageService.StorageUpdate storageUpdate = storageService.beginUpdate(studentId);
        try {
            for (FaceEnrollmentGateway.FaceCapture capture : verified.captures()) {
                storageService.saveCaptureImage(studentId, capture.pose(), capture.jpegBytes());
                if ("front".equals(capture.pose())) {
                    storageService.savePrimaryImage(studentId, capture.jpegBytes());
                }
            }
            storageService.writeMetadata(studentId, verified.metadata());
            persistEnrollment(studentId, FaceEnrollmentStatus.VERIFIED);
            finishWithSurroundingTransaction(storageUpdate);

            return new FaceEnrollmentResponse(
                    studentId,
                    true,
                    true,
                    FaceEnrollmentStatus.VERIFIED,
                    verified.message(),
                    storageService.photoUrl(studentId),
                    listCaptures(studentId)
            );
        } catch (RuntimeException ex) {
            storageUpdate.rollback();
            throw ex;
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public FaceEnrollmentResponse enrolFace(UUID studentId, MultipartFile image) {
        Student student = studentService.findEntity(studentId);
        requireConsent(student);
        byte[] bytes = imageUploadService.normaliseToJpeg(image);
        AiFaceEnrollmentResponse response = faceEnrollmentGateway.verifyCaptures(
                student.getStudentNumber(),
                List.of(new FaceEnrollmentGateway.FaceCapture("front", bytes))
        );
        FaceEnrollmentStatus nextStatus = mapAiStatus(response);

        FaceEnrollmentStorageService.StorageUpdate storageUpdate = storageService.beginUpdate(studentId);
        try {
            storageService.savePrimaryImage(studentId, bytes);
            persistEnrollment(studentId, nextStatus);
            storageUpdate.commit();
            return new FaceEnrollmentResponse(
                    studentId,
                    response.imageAccepted(),
                    response.aiVerified(),
                    nextStatus,
                    response.message(),
                    storageService.photoUrl(studentId),
                    listCaptures(studentId)
            );
        } catch (RuntimeException ex) {
            storageUpdate.rollback();
            throw ex;
        }
    }

    public FaceEnrollmentResponse enrolFaceCaptures(
            UUID studentId,
            String metadataJson,
            List<MultipartFile> images
    ) {
        Student student = studentService.findEntity(studentId);
        requireConsent(student);
        try {
            FaceRegistrationVerifier.VerifiedCaptureSet verified = registrationVerifier.verify(
                    student.getStudentNumber(), metadataJson, images);
            return persistVerifiedCaptures(studentId, verified);
        } catch (ResponseStatusException ex) {
            markFailed(student);
            throw ex;
        }
    }

    public Resource getPhoto(UUID studentId) {
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Face enrollment photo not found."));
        if (!enrollment.getImagePath().equals(storageService.publicImagePath(studentId))) {
            throw new ResponseStatusException(NOT_FOUND, "Face enrollment photo not found.");
        }
        return storageService.primaryPhoto(studentId);
    }

    public Resource getCapturePhoto(UUID studentId, String pose) {
        studentService.findEntity(studentId);
        return storageService.capturePhoto(studentId, pose);
    }

    public List<FaceEnrollmentCaptureResponse> listCaptures(UUID studentId) {
        return storageService.listCaptures(studentId);
    }

    public MediaType photoMediaType() {
        return MediaType.IMAGE_JPEG;
    }

    public String safePose(String pose) {
        return storageService.safePose(pose);
    }

    private FaceEnrollmentStatus mapAiStatus(AiFaceEnrollmentResponse response) {
        if (response.imageAccepted()
                && response.aiVerified()
                && "VERIFIED".equalsIgnoreCase(response.status())) {
            return FaceEnrollmentStatus.VERIFIED;
        }
        if (response.imageAccepted() && "PHOTO_CAPTURED".equalsIgnoreCase(response.status())) {
            return FaceEnrollmentStatus.PHOTO_CAPTURED;
        }
        return FaceEnrollmentStatus.FAILED;
    }

    private void requireConsent(Student student) {
        if (!student.isConsentGiven()) {
            throw new ResponseStatusException(BAD_REQUEST, "Consent is required before face enrollment.");
        }
    }

    private void markFailed(Student student) {
        studentService.updateFaceEnrollmentStatus(student.getId(), FaceEnrollmentStatus.FAILED);
    }

    private void persistEnrollment(UUID studentId, FaceEnrollmentStatus status) {
        transactionTemplate.executeWithoutResult(transactionStatus -> {
            Student managedStudent = studentService.findEntity(studentId);
            FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                    .orElseGet(FaceEnrollment::new);
            enrollment.setStudent(managedStudent);
            enrollment.setImagePath(storageService.publicImagePath(studentId));
            enrollment.setStatus(status);
            studentService.updateFaceEnrollmentStatus(studentId, status);
            faceEnrollmentRepository.save(enrollment);
        });
    }

    private void finishWithSurroundingTransaction(
            FaceEnrollmentStorageService.StorageUpdate storageUpdate
    ) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            storageUpdate.commit();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int completionStatus) {
                if (completionStatus == STATUS_COMMITTED) {
                    storageUpdate.commit();
                } else {
                    storageUpdate.rollback();
                }
            }
        });
    }

}
