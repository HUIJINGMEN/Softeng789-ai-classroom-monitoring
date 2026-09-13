package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RoomResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.RoomService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.NO_CONTENT;

@RestController
@RequestMapping("/api/admin/rooms")
public class RoomController {
    private final RoomService roomService;
    private final SessionAuthService sessionAuthService;

    public RoomController(RoomService roomService, SessionAuthService sessionAuthService) {
        this.roomService = roomService;
        this.sessionAuthService = sessionAuthService;
    }

    // Readable by any authenticated teacher — see CampusController for why the list endpoints
    // aren't admin-only even though they live under /api/admin (scheduling a session needs this
    // regardless of who's scheduling it).
    @GetMapping
    public List<RoomResponse> list(
            @RequestParam(required = false) UUID campusId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireTeacher(authorization);
        return roomService.listRooms(campusId);
    }

    @PostMapping
    public RoomResponse create(
            @Valid @RequestBody CreateRoomRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return roomService.createRoom(request);
    }

    @PutMapping("/{id}")
    public RoomResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRoomRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return roomService.updateRoom(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(NO_CONTENT)
    public void delete(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        roomService.deleteRoom(id);
    }
}
