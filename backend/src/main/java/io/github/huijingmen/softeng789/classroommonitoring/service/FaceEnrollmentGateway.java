package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Application boundary for face-enrollment analysis.
 *
 * <p>The education server owns registration and storage. An AI provider only evaluates the saved
 * capture and returns a provider-neutral result. Laboratory integrations should implement this
 * interface instead of being called directly from controllers or domain services.</p>
 */
public interface FaceEnrollmentGateway {
    AiFaceEnrollmentResponse validateFaceEnrollmentImage(UUID studentId, Path imagePath);
}
