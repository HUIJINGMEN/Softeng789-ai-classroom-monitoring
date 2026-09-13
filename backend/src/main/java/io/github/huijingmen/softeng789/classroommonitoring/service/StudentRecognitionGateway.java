package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.List;
import java.util.UUID;

/** Replace this gateway with the lab service adapter when its API is available. Keeping the AI
 * boundary here prevents its request/response format from leaking into controllers or the app. */
public interface StudentRecognitionGateway {
    RecognitionMatch recognize(byte[] photo, List<Student> candidates);

    record RecognitionMatch(UUID studentId, double confidence, String mode) {
    }
}
