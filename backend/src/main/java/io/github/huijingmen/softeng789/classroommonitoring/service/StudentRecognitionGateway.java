package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.util.List;
import java.util.UUID;

/** Replace this gateway with the lab service adapter when its API is available. Keeping the AI
 * boundary here prevents its request/response format from leaking into controllers or the app. */
public interface StudentRecognitionGateway {
    RecognitionMatch recognize(byte[] photo, List<RecognitionCandidate> candidates);

    /** The AI adapter receives only the identity fields it needs, rather than a persistence
     * entity whose lazy relationships would couple the remote call to an open transaction. */
    record RecognitionCandidate(UUID studentId, String fullName, String studentNumber) {
    }

    record RecognitionMatch(UUID studentId, double confidence, String mode) {
    }
}
