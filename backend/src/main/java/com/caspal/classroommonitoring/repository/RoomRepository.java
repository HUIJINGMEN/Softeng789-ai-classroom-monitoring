package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.Room;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<Room, UUID> {
    Optional<Room> findByCodeIgnoreCase(String code);
}
