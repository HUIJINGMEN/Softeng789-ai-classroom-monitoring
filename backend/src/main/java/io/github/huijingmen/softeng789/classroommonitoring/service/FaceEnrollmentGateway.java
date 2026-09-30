package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import java.util.List;

/**
 * Application boundary for face-enrollment analysis.
 *
 * <p>The education server owns registration and storage. An AI provider only evaluates the saved
 * capture set and returns a provider-neutral result. Laboratory integrations should implement this
 * interface instead of being called directly from controllers or domain services.</p>
 */
public interface FaceEnrollmentGateway {
    AiFaceEnrollmentResponse verifyCaptures(String subjectId, List<FaceCapture> captures);

    record FaceCapture(String pose, byte[] jpegBytes) {
        public FaceCapture {
            jpegBytes = jpegBytes.clone();
        }

        @Override
        public byte[] jpegBytes() {
            return jpegBytes.clone();
        }
    }
}
