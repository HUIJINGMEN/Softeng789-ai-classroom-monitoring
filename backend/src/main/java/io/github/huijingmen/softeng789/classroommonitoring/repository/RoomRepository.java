package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<Room, UUID> {
    Optional<Room> findByCodeIgnoreCase(String code);

    Optional<Room> findByCampus_IdAndCodeIgnoreCase(UUID campusId, String code);

    List<Room> findByCampus_IdOrderByCodeAsc(UUID campusId);

    List<Room> findAllByOrderByCampus_NameAscCodeAsc();

    long countByCampus_Id(UUID campusId);
}
