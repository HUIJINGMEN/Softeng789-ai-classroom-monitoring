package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassroomSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassroomSessionService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/sessions")
public class ClassroomSessionController {
    private final ClassroomSessionService classroomSessionService;
    private final SessionAuthService sessionAuthService;
    private final StaffAccessService staffAccessService;

    public ClassroomSessionController(
            ClassroomSessionService classroomSessionService,
            SessionAuthService sessionAuthService,
            StaffAccessService staffAccessService
    ) {
        this.classroomSessionService = classroomSessionService;
        this.sessionAuthService = sessionAuthService;
        this.staffAccessService = staffAccessService;
    }

    @GetMapping
    public List<ClassroomSessionResponse> listClassroomSessions(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return classroomSessionService.listSessions(callerId);
    }

    @GetMapping("/page")
    public PageResponse<ClassroomSessionResponse> listClassroomSessionsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return classroomSessionService.listSessions(callerId, page, size, query);
    }

    @GetMapping("/{id}")
    public ClassroomSessionResponse getClassroomSession(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireSessionAccess(callerId, id);
        return classroomSessionService.getSession(id);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public ClassroomSessionResponse createClassroomSession(
            @Valid @RequestBody CreateClassroomSessionRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireOfferingAccess(callerId, request.courseOfferingId());
        return classroomSessionService.createSession(request);
    }

    @PutMapping("/{id}")
    public ClassroomSessionResponse updateClassroomSession(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateClassroomSessionRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireSessionAccess(callerId, id);
        staffAccessService.requireOfferingAccess(callerId, request.courseOfferingId());
        return classroomSessionService.updateSession(id, request);
    }

    @PostMapping("/{id}/start")
    public ClassroomSessionResponse startClassroomSession(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireSessionAccess(callerId, id);
        return classroomSessionService.startSession(id);
    }

    @PostMapping("/{id}/end")
    public ClassroomSessionResponse endClassroomSession(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireSessionAccess(callerId, id);
        return classroomSessionService.endSession(id);
    }

    @PostMapping("/{id}/cancel")
    public ClassroomSessionResponse cancelClassroomSession(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        staffAccessService.requireSessionAccess(callerId, id);
        return classroomSessionService.cancelSession(id);
    }
}
