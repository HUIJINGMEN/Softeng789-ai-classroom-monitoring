package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.client.AiServerClient;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FaceEnrollmentService {
    private static final String LOCAL_CAPTURE_MESSAGE =
            "Face enrollment captures were saved locally for later CARES verification.";

    private final StudentService studentService;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final AiServerClient aiServerClient;
    private final FaceEnrollmentStorageService storageService;

    public FaceEnrollmentService(
            StudentService studentService,
            FaceEnrollmentRepository faceEnrollmentRepository,
            AiServerClient aiServerClient,
            FaceEnrollmentStorageService storageService
    ) {
        this.studentService = studentService;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.aiServerClient = aiServerClient;
        this.storageService = storageService;
    }

    public FaceEnrollmentResponse enrolFace(UUID studentId, MultipartFile image) {
        Student student = studentService.findEntity(studentId);
        if (!student.isConsentGiven()) {
            throw new ResponseStatusException(BAD_REQUEST, "Consent is required before face enrollment.");
        }

        byte[] bytes = readValidImage(image, student);
        Path savedImage = storageService.savePrimaryImage(studentId, bytes);
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseGet(FaceEnrollment::new);
        enrollment.setStudent(student);
        enrollment.setImagePath(storageService.publicImagePath(studentId));

        AiFaceEnrollmentResponse aiResponse = aiServerClient.validateFaceEnrollmentImage(studentId, savedImage);
        FaceEnrollmentStatus nextStatus = mapAiStatus(aiResponse);

        enrollment.setStatus(nextStatus);
        studentService.updateFaceEnrollmentStatus(studentId, nextStatus);
        faceEnrollmentRepository.save(enrollment);

        return new FaceEnrollmentResponse(
                studentId,
                aiResponse.imageAccepted(),
                aiResponse.aiVerified(),
                nextStatus,
                aiResponse.message(),
                storageService.photoUrl(studentId),
                listCaptures(studentId)
        );
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
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseGet(FaceEnrollment::new);
        enrollment.setStudent(student);
        enrollment.setImagePath(storageService.publicImagePath(studentId));
        enrollment.setStatus(FaceEnrollmentStatus.PHOTO_CAPTURED);
        studentService.updateFaceEnrollmentStatus(studentId, FaceEnrollmentStatus.PHOTO_CAPTURED);
        faceEnrollmentRepository.save(enrollment);

        return new FaceEnrollmentResponse(
                studentId,
                true,
                false,
                FaceEnrollmentStatus.PHOTO_CAPTURED,
                LOCAL_CAPTURE_MESSAGE,
                storageService.photoUrl(studentId),
                listCaptures(studentId)
        );
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

    private byte[] readValidImage(MultipartFile image, Student student) {
        if (image == null || image.isEmpty()) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "Image is required.");
        }

        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "Uploaded file must be an image.");
        }

        try {
            byte[] bytes = image.getBytes();
            if (!hasSupportedImageSignature(bytes)) {
                markFailed(student);
                throw new ResponseStatusException(BAD_REQUEST, "Uploaded image could not be read.");
            }
            return bytes;
        } catch (IOException ex) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "Uploaded image could not be read.", ex);
        }
    }

    private boolean hasSupportedImageSignature(byte[] bytes) {
        if (bytes.length < 4) return false;
        boolean jpeg = (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8;
        boolean png = (bytes[0] & 0xff) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47;
        boolean gif = bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46;
        boolean webp = bytes.length >= 12
                && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
        return jpeg || png || gif || webp;
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

}
