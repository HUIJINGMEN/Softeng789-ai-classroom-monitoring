package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Explicit local-demo adapter. It simulates the laboratory decision only when the developer opts
 * into {@code FACE_ENROLLMENT_PROVIDER=demo}; production/default HTTP mode never converts a
 * transport-only photo capture into a verified registration.
 */
@Component
@ConditionalOnProperty(name = "ai.face-enrollment.provider", havingValue = "demo")
public class DemoFaceEnrollmentGateway implements FaceEnrollmentGateway {
    private static final Set<String> REQUIRED_POSES = Set.of(
            "front", "slight_left", "left", "slight_right", "right", "chin_up", "chin_down");

    @Override
    public AiFaceEnrollmentResponse verifyCaptures(String subjectId, List<FaceCapture> captures) {
        Set<String> poses = captures.stream().map(FaceCapture::pose).collect(Collectors.toSet());
        boolean complete = poses.containsAll(REQUIRED_POSES)
                && captures.stream().allMatch(capture -> capture.jpegBytes().length > 0);
        return new AiFaceEnrollmentResponse(
                subjectId,
                complete,
                complete,
                complete ? "VERIFIED" : "FAILED",
                complete
                        ? "Demo verification passed. Replace this provider before production use."
                        : "Every required face-enrollment pose must be captured.",
                "DEMO"
        );
    }
}
