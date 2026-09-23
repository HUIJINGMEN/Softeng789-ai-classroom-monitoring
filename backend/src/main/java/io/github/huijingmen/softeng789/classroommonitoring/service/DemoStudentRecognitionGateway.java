package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Deterministic presentation adapter used until the laboratory supplies student recognition.
 * It never claims to be a real model: every response is explicitly labelled DEMO and the mobile
 * UI requires the teacher to confirm or correct the match before saving feedback. */
@Component
@ConditionalOnProperty(
        name = "ai.student-recognition.provider",
        havingValue = "demo",
        matchIfMissing = true
)
public class DemoStudentRecognitionGateway implements StudentRecognitionGateway {
    @Override
    public RecognitionMatch recognize(byte[] photo, List<RecognitionCandidate> candidates) {
        if (candidates.isEmpty()) {
            throw new IllegalArgumentException("No students are available for recognition.");
        }
        byte[] digest = sha256(photo);
        int index = Math.floorMod(ByteBuffer.wrap(digest).getInt(), candidates.size());
        double confidence = 0.84 + (Byte.toUnsignedInt(digest[4]) % 11) / 100.0;
        return new RecognitionMatch(candidates.get(index).studentId(), confidence, "DEMO");
    }

    private byte[] sha256(byte[] photo) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(photo);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }
}
