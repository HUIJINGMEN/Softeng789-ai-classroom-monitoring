package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
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
    private static final TypeReference<List<FaceEnrollmentCaptureMetadata>> CAPTURE_METADATA_LIST =
            new TypeReference<>() {
            };
    private static final String LOCAL_CAPTURE_MESSAGE =
            "Face enrollment captures were saved locally for later CARES verification.";

    private final StudentService studentService;
    private final FaceEnrollmentRepository faceEnrollmentRepository;
    private final AiServerClient aiServerClient;
    private final ObjectMapper objectMapper;
    private final Path storageRoot;

    public FaceEnrollmentService(
            StudentService studentService,
            FaceEnrollmentRepository faceEnrollmentRepository,
            AiServerClient aiServerClient,
            ObjectMapper objectMapper,
            @Value("${app.storage.face-enrollment-dir:../data/face-enrollment}") String storageRoot
    ) {
        this.studentService = studentService;
        this.faceEnrollmentRepository = faceEnrollmentRepository;
        this.aiServerClient = aiServerClient;
        this.objectMapper = objectMapper;
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
                photoUrl(studentId),
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

        List<FaceEnrollmentCaptureMetadata> metadata = readMetadata(metadataJson);
        if (metadata.size() != images.size()) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata must match the uploaded images.");
        }

        Path frontImage = null;
        for (int index = 0; index < metadata.size(); index += 1) {
            FaceEnrollmentCaptureMetadata capture = metadata.get(index);
            String pose = safePose(capture.pose());
            byte[] bytes = readValidImage(images.get(index), student);
            Path savedImage = saveCaptureImage(studentId, pose, bytes);
            if ("front".equals(pose)) {
                frontImage = savedImage;
                saveImage(studentId, bytes);
            }
        }

        if (frontImage == null) {
            markFailed(student);
            throw new ResponseStatusException(BAD_REQUEST, "A front capture is required for enrollment.");
        }

        writeMetadata(studentId, metadata);
        FaceEnrollment enrollment = faceEnrollmentRepository.findByStudent_Id(studentId)
                .orElseGet(FaceEnrollment::new);
        enrollment.setStudent(student);
        enrollment.setImagePath(publicImagePath(studentId));
        enrollment.setStatus(FaceEnrollmentStatus.PHOTO_CAPTURED);
        student.setFaceEnrollmentStatus(FaceEnrollmentStatus.PHOTO_CAPTURED);
        studentService.save(student);
        faceEnrollmentRepository.save(enrollment);

        return new FaceEnrollmentResponse(
                studentId,
                true,
                false,
                FaceEnrollmentStatus.PHOTO_CAPTURED,
                LOCAL_CAPTURE_MESSAGE,
                photoUrl(studentId),
                listCaptures(studentId)
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

    public Resource getCapturePhoto(UUID studentId, String pose) {
        studentService.findEntity(studentId);
        Path photo = captureImagePath(studentId, safePose(pose));
        if (!Files.isRegularFile(photo)) {
            throw new ResponseStatusException(NOT_FOUND, "Face enrollment capture not found.");
        }
        return new FileSystemResource(photo);
    }

    public List<FaceEnrollmentCaptureResponse> listCaptures(UUID studentId) {
        Path metadataPath = metadataPath(studentId);
        if (!Files.isRegularFile(metadataPath)) {
            return List.of();
        }

        try {
            List<FaceEnrollmentCaptureMetadata> metadata =
                    objectMapper.readValue(metadataPath.toFile(), CAPTURE_METADATA_LIST);
            return metadata.stream()
                    .map(capture -> new FaceEnrollmentCaptureResponse(
                            safePose(capture.pose()),
                            capture.label(),
                            capturePhotoUrl(studentId, capture.pose()),
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

    private Path saveCaptureImage(UUID studentId, String pose, byte[] bytes) {
        try {
            Path captureDir = storageRoot.resolve(studentId.toString()).resolve("captures").normalize();
            Files.createDirectories(captureDir);
            Path imagePath = captureDir.resolve(pose + ".jpg").normalize();
            Files.write(imagePath, bytes);
            return imagePath;
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment capture.", ex);
        }
    }

    private List<FaceEnrollmentCaptureMetadata> readMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata is required.");
        }
        try {
            return objectMapper.readValue(metadataJson, CAPTURE_METADATA_LIST);
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata could not be read.", ex);
        }
    }

    private void writeMetadata(UUID studentId, List<FaceEnrollmentCaptureMetadata> metadata) {
        try {
            Path studentDir = storageRoot.resolve(studentId.toString()).normalize();
            Files.createDirectories(studentDir);
            objectMapper.writeValue(metadataPath(studentId).toFile(), metadata);
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment metadata.", ex);
        }
    }

    private Path metadataPath(UUID studentId) {
        return storageRoot.resolve(studentId.toString()).resolve("captures.json").normalize();
    }

    private Path captureImagePath(UUID studentId, String pose) {
        return storageRoot.resolve(studentId.toString()).resolve("captures").resolve(pose + ".jpg").normalize();
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

    private String capturePhotoUrl(UUID studentId, String pose) {
        return "/api/students/" + studentId + "/face-enrollment/captures/" + safePose(pose) + "/photo";
    }

    private String safePose(String pose) {
        if (pose == null || pose.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is required.");
        }
        String safe = pose.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
        if (safe.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is invalid.");
        }
        return safe;
    }
}
