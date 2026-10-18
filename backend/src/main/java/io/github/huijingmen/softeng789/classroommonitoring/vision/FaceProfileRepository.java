package io.github.huijingmen.softeng789.classroommonitoring.vision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface FaceProfileRepository extends JpaRepository<FaceProfile, UUID> {}
