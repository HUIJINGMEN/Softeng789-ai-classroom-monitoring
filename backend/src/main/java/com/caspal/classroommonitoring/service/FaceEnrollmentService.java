package com.caspal.classroommonitoring.service;

import com.caspal.classroommonitoring.client.AiServerClient;
import com.caspal.classroommonitoring.dto.AiFaceEnrollmentResponse;
import com.caspal.classroommonitoring.dto.FaceEnrollmentResponse;
import com.caspal.classroommonitoring.entity.FaceEnrollment;
import com.caspal.classroommonitoring.entity.FaceEnrollmentStatus;
import com.caspal.classroommonitoring.entity.Student;
import com.caspal.classroommonitoring.repository.FaceEnrollmentRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FaceEnrollmentService {
    private final StudentService studentService;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final AiServerClient aiServerClient;
    private final Path storageRoot;

    public FaceEnrollmentService(
            StudentService studentService,
            FaceEnrollmentRepository faceEnrollmentRepository,
            AiServerClient aiServerClient,
            @Value("${app.storage.face-enrollment-dir:../data/face-enrollment}") String storageRoot
    ) {
        this.studentService = studentService;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.aiServerClient = aiServerClient;
        this.storageRoot = Path.of(storageRoot);
    }

    public FaceEnrollmentResponse enrolFace(UUID studentId, MultipartFile image) {
        Student student = studentService.findEntity(studentId);
        if (!student.isConsentGiven()) {
            throw new ResponseStatusException(BAD_REQUEST, "Consent is required before face enrollment.");
        }

        byte[] bytes = readValidImage(image, student);
        Path savedImage = saveImage(studentId, bytes);
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseGet(FaceEnrollment::new);
        enrollment.setStudent(student);
        enrollment.setImagePath(publicImagePath(studentId));

        AiFaceEnrollmentResponse aiResponse = aiServerClient.validateFaceEnrollmentImage(studentId, savedImage);
        FaceEnrollmentStatus nextStatus = mapAiStatus(aiResponse);

        enrollment.setStatus(nextStatus);
        student.setFaceEnrollmentStatus(nextStatus);
        studentService.save(student);
        faceEnrollmentRepository.save(enrollment);

        return new FaceEnrollmentResponse(
                studentId,
                aiResponse.imageAccepted(),
                aiResponse.aiVerified(),
                nextStatus,
                aiResponse.message(),
                photoUrl(studentId)
        );
    }

    public Resource getPhoto(UUID studentId) {
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Face enrollment photo not found."));
        Path photo = storageRoot.resolve(studentId.toString()).resolve("enrollment.jpg").normalize();
        if (!Files.isRegularFile(photo) || !enrollment.getImagePath().equals(publicImagePath(studentId))) {
            throw new ResponseStatusException(NOT_FOUND, "Face enrollment photo not found.");
        }
        return new FileSystemResource(photo);
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

    private Path saveImage(UUID studentId, byte[] bytes) {
        try {
            Path studentDir = storageRoot.resolve(studentId.toString()).normalize();
            Files.createDirectories(studentDir);
            Path imagePath = studentDir.resolve("enrollment.jpg");
            Files.write(imagePath, bytes);
            return imagePath;
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment image.", ex);
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
        student.setFaceEnrollmentStatus(FaceEnrollmentStatus.FAILED);
        studentService.save(student);
    }

    private String publicImagePath(UUID studentId) {
        return "data/face-enrollment/" + studentId + "/enrollment.jpg";
    }

    private String photoUrl(UUID studentId) {
        return "/api/students/" + studentId + "/face-enrollment/photo";
    }
}
