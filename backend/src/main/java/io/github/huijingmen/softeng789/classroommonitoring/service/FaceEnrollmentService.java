package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
    private static final Set<String> REQUIRED_CAPTURE_POSES = Set.of(
            "front",
            "slight_left",
            "left",
            "slight_right",
            "right",
            "chin_up",
            "chin_down"
    );
    private static final String LOCAL_CAPTURE_MESSAGE =
            "Face enrollment captures were saved locally for later CARES verification.";

    private final StudentService studentService;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final FaceEnrollmentGateway faceEnrollmentGateway;
    private final FaceEnrollmentStorageService storageService;
    private final ImageUploadService imageUploadService;
    private final TransactionTemplate transactionTemplate;

    public FaceEnrollmentService(
            StudentService studentService,
            FaceEnrollmentRepository faceEnrollmentRepository,
            FaceEnrollmentGateway faceEnrollmentGateway,
            FaceEnrollmentStorageService storageService,
            ImageUploadService imageUploadService,
            PlatformTransactionManager transactionManager
    ) {
        this.studentService = studentService;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.faceEnrollmentGateway = faceEnrollmentGateway;
        this.storageService = storageService;
        this.imageUploadService = imageUploadService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public FaceEnrollmentResponse enrolFace(UUID studentId, MultipartFile image) {
        Student student = studentService.findEntity(studentId);
        if (!student.isConsentGiven()) {
            throw new ResponseStatusException(BAD_REQUEST, "Consent is required before face enrollment.");
        }

        byte[] bytes = readValidImage(image, student);
        FaceEnrollmentStorageService.StorageUpdate storageUpdate = storageService.beginUpdate(studentId);
        try {
            Path savedImage = storageService.savePrimaryImage(studentId, bytes);
            AiFaceEnrollmentResponse aiResponse =
                    faceEnrollmentGateway.validateFaceEnrollmentImage(studentId, savedImage);
            FaceEnrollmentStatus nextStatus = mapAiStatus(aiResponse);

            persistEnrollment(studentId, nextStatus);
            storageUpdate.commit();

            return new FaceEnrollmentResponse(
                    studentId,
                    aiResponse.imageAccepted(),
                    aiResponse.aiVerified(),
                    nextStatus,
                    aiResponse.message(),
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
        if (!student.isConsentGiven()) {
            throw new ResponseStatusException(BAD_REQUEST, "Consent is required before face enrollment.");
        }
        if (images == null || images.isEmpty()) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "At least one enrollment capture is required.");
        }

        List<FaceEnrollmentCaptureMetadata> metadata = storageService.readMetadata(metadataJson);
        if (metadata.size() != images.size()) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata must match the uploaded images.");
        }

        Set<String> uploadedPoses = metadata.stream()
                .map(FaceEnrollmentCaptureMetadata::pose)
                .map(storageService::safePose)
                .collect(Collectors.toSet());
        if (!uploadedPoses.containsAll(REQUIRED_CAPTURE_POSES)) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST,
                    "Complete every required face enrollment capture before submitting.");
        }

        FaceEnrollmentStorageService.StorageUpdate storageUpdate = storageService.beginUpdate(studentId);
        try {
            Path frontImage = null;
            for (int index = 0; index < metadata.size(); index += 1) {
                FaceEnrollmentCaptureMetadata capture = metadata.get(index);
                String pose = storageService.safePose(capture.pose());
                byte[] bytes = readValidImage(images.get(index), student);
                Path savedImage = storageService.saveCaptureImage(studentId, pose, bytes);
                if ("front".equals(pose)) {
                    frontImage = savedImage;
                    storageService.savePrimaryImage(studentId, bytes);
                }
            }

            if (frontImage == null) {
                markFailed(student);
                throw new ResponseStatusException(BAD_REQUEST, "A front capture is required for enrollment.");
            }

            storageService.writeMetadata(studentId, metadata);
            persistEnrollment(studentId, FaceEnrollmentStatus.PHOTO_CAPTURED);
            finishWithSurroundingTransaction(storageUpdate);

            return new FaceEnrollmentResponse(
                    studentId,
                    true,
                    false,
                    FaceEnrollmentStatus.PHOTO_CAPTURED,
                    LOCAL_CAPTURE_MESSAGE,
                    storageService.photoUrl(studentId),
                    listCaptures(studentId)
            );
        } catch (RuntimeException ex) {
            storageUpdate.rollback();
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

    private byte[] readValidImage(MultipartFile image, Student student) {
        try {
            return imageUploadService.normaliseToJpeg(image);
        } catch (ResponseStatusException ex) {
            markFailed(student);
            throw ex;
        }
    }

    private FaceEnrollmentStatus mapAiStatus(AiFaceEnrollmentResponse response) {
        if (!response.imageAccepted()) {
            return FaceEnrollmentStatus.FAILED;
        }
        if ("PHOTO_CAPTURED".equals(response.status())) {
            return FaceEnrollmentStatus.PHOTO_CAPTURED;
        }
        return FaceEnrollmentStatus.FAILED;
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
