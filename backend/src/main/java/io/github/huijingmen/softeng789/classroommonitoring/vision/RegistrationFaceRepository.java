package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistrationFaceRepository extends JpaRepository<RegistrationFace, UUID> {
    List<RegistrationFace> findByStateAndExpiresAtBefore(String state, Instant now);
}
