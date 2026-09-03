package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AdminService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/admin/staff")
public class AdminController {
    private final AdminService adminService;
    private final SessionAuthService sessionAuthService;

    public AdminController(AdminService adminService, SessionAuthService sessionAuthService) {
        this.adminService = adminService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<StaffResponse> listStaff(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminService.listStaff();
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public StaffResponse createStaff(
            @Valid @RequestBody CreateStaffRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminService.createStaff(request);
    }

    @PutMapping("/{id}")
    public StaffResponse updateStaff(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStaffRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return adminService.updateStaffStatus(id, request, adminId);
    }
}
