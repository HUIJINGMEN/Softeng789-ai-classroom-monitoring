package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RoomResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Campus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final CampusService campusService;

    public RoomService(RoomRepository roomRepository, CampusService campusService) {
        this.roomRepository = roomRepository;
        this.campusService = campusService;
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> listRooms(UUID campusId) {
        List<Room> rooms = campusId == null
                ? roomRepository.findAllByOrderByCampus_NameAscCodeAsc()
                : roomRepository.findByCampus_IdOrderByCodeAsc(campusId);
        return rooms.stream().map(this::toResponse).toList();
    }

    // Rooms are now provisioned explicitly by an Admin, the same way AdminClassService provisions
    // classes — scheduling a session just picks one of the rooms that already exists, it can no
    // longer mint a new one from whatever text a teacher happened to type in.
    @Transactional
    public RoomResponse createRoom(CreateRoomRequest request) {
        Campus campus = campusService.findEntity(request.campusId());
        String code = requireText(request.code(), "Room code is required.");
        String name = requireText(request.name(), "Room name is required.");
        if (roomRepository.findByCampus_IdAndCodeIgnoreCase(campus.getId(), code).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "This campus already has a room with that code.");
        }

        Room room = new Room();
        room.setCampus(campus);
        room.setCode(code);
        room.setName(name);
        room.setCapacity(request.capacity());
        return toResponse(roomRepository.save(room));
    }

    @Transactional
    public RoomResponse updateRoom(UUID id, UpdateRoomRequest request) {
        Room room = findEntity(id);
        Campus campus = campusService.findEntity(request.campusId());
        String code = requireText(request.code(), "Room code is required.");
        String name = requireText(request.name(), "Room name is required.");
        roomRepository.findByCampus_IdAndCodeIgnoreCase(campus.getId(), code).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(CONFLICT, "This campus already has a room with that code.");
            }
        });

        room.setCampus(campus);
        room.setCode(code);
        room.setName(name);
        room.setCapacity(request.capacity());
        return toResponse(roomRepository.save(room));
    }

    // A room's FK on classroom_sessions is ON DELETE SET NULL — deleting one never breaks a past
    // session, it just falls back to that session's own frozen room-text snapshot (the same
    // fallback sessionRoomLabel already uses on the frontend for a session predating this rollout).
    @Transactional
    public void deleteRoom(UUID id) {
        roomRepository.delete(findEntity(id));
    }

    private Room findEntity(UUID id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Room not found."));
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private RoomResponse toResponse(Room room) {
        Campus campus = room.getCampus();
        return new RoomResponse(
                room.getId(),
                campus.getId(),
                campus.getName(),
                room.getCode(),
                room.getName(),
                room.getCapacity()
        );
    }
}
