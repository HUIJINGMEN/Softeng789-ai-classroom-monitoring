package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY;

/**
 * Registration-only biometric gate.
 *
 * <p>This component owns capture-set validation and provider response interpretation. It performs
 * no registration, file-system or database writes, so replacing the laboratory adapter cannot
 * accidentally change registration persistence.</p>
 */
@Service
public class FaceRegistrationVerifier {
    private static final Set<String> REQUIRED_CAPTURE_POSES = Set.of(
            "front",
            "slight_left",
            "left",
            "slight_right",
            "right",
            "chin_up",
            "chin_down"
    );

    private final FaceEnrollmentGateway gateway;
    private final FaceCaptureMetadataCodec metadataCodec;
    private final ImageUploadService imageUploadService;

    public FaceRegistrationVerifier(
            FaceEnrollmentGateway gateway,
            FaceCaptureMetadataCodec metadataCodec,
            ImageUploadService imageUploadService
    ) {
        this.gateway = gateway;
        this.metadataCodec = metadataCodec;
        this.imageUploadService = imageUploadService;
    }

    /**
     * Verifies a complete registration capture set outside any caller database transaction.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public VerifiedCaptureSet verify(
            String subjectId,
            String metadataJson,
            List<MultipartFile> images
    ) {
        List<FaceEnrollmentCaptureMetadata> metadata = validateMetadata(metadataJson, images);
        List<FaceEnrollmentGateway.FaceCapture> captures = normaliseCaptures(metadata, images);
        AiFaceEnrollmentResponse response = gateway.verifyCaptures(subjectId, captures);
        requireVerifiedResponse(subjectId, response);
        return new VerifiedCaptureSet(metadata, captures, response.provider(), response.message());
    }

    private List<FaceEnrollmentCaptureMetadata> validateMetadata(
            String metadataJson,
            List<MultipartFile> images
    ) {
        if (images == null || images.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Every face-enrollment capture is required.");
        }
        List<FaceEnrollmentCaptureMetadata> metadata = metadataCodec.parseRequired(metadataJson);
        if (metadata.size() != images.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata must match the uploaded images.");
        }

        Set<String> poses = new HashSet<>();
        for (FaceEnrollmentCaptureMetadata capture : metadata) {
            String pose = metadataCodec.requireSafePose(capture.pose());
            if (!REQUIRED_CAPTURE_POSES.contains(pose) || !poses.add(pose)) {
                throw new ResponseStatusException(BAD_REQUEST,
                        "The face-enrollment capture set contains a duplicate or unsupported pose.");
            }
        }
        if (!poses.equals(REQUIRED_CAPTURE_POSES)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Complete every required face-enrollment capture before submitting.");
        }
        return List.copyOf(metadata);
    }

    private List<FaceEnrollmentGateway.FaceCapture> normaliseCaptures(
            List<FaceEnrollmentCaptureMetadata> metadata,
            List<MultipartFile> images
    ) {
        return IntStream.range(0, metadata.size())
                .mapToObj(index -> new FaceEnrollmentGateway.FaceCapture(
                        metadataCodec.requireSafePose(metadata.get(index).pose()),
                        imageUploadService.normaliseToJpeg(images.get(index))))
                .toList();
    }

    private void requireVerifiedResponse(String subjectId, AiFaceEnrollmentResponse response) {
        if (response == null) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE,
                    "Face verification returned no result. No registration request was created.");
        }
        if (!subjectId.equals(response.studentId())) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE,
                    "Face verification returned a mismatched result. No registration request was created.");
        }
        if ("UNAVAILABLE".equalsIgnoreCase(response.status())) {
            String message = response.message() == null || response.message().isBlank()
                    ? "Face verification is temporarily unavailable. No registration request was created."
                    : response.message();
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, message);
        }

        boolean verified = response.imageAccepted()
                && response.aiVerified()
                && "VERIFIED".equalsIgnoreCase(response.status());
        if (!verified) {
            String message = response.message() == null || response.message().isBlank()
                    ? "Face verification did not pass. No registration request was created."
                    : response.message();
            throw new ResponseStatusException(UNPROCESSABLE_ENTITY, message);
        }
    }

    public record VerifiedCaptureSet(
            List<FaceEnrollmentCaptureMetadata> metadata,
            List<FaceEnrollmentGateway.FaceCapture> captures,
            String provider,
            String message
    ) {
        public VerifiedCaptureSet {
            metadata = List.copyOf(metadata);
            captures = List.copyOf(captures);
            provider = provider == null ? "UNKNOWN" : provider.trim().toUpperCase(Locale.ROOT);
        }
    }
}
