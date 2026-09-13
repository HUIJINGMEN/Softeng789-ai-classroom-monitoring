package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CampusResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.CampusService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.NO_CONTENT;

@RestController
@RequestMapping("/api/admin/campuses")
public class CampusController {
    private final CampusService campusService;
    private final SessionAuthService sessionAuthService;

    public CampusController(CampusService campusService, SessionAuthService sessionAuthService) {
        this.campusService = campusService;
        this.sessionAuthService = sessionAuthService;
    }

    // Readable by any authenticated teacher (not just admins) — scheduling a session needs the
    // full campus list regardless of who's doing the scheduling, the same way the class picker
    // already works. Only creating/editing/deleting a campus is admin-only.
    @GetMapping
    public List<CampusResponse> list(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireTeacher(authorization);
        return campusService.listCampuses();
    }

    @PostMapping
    public CampusResponse create(
            @Valid @RequestBody CreateCampusRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return campusService.createCampus(request);
    }

    @PutMapping("/{id}")
    public CampusResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCampusRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return campusService.updateCampus(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(NO_CONTENT)
    public void delete(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        campusService.deleteCampus(id);
    }
}
