package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.AdminService;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    private final AuthService authService;

    public AdminController(AdminService adminService, AuthService authService) {
        this.adminService = adminService;
        this.authService = authService;
    }

    @GetMapping
    public List<StaffResponse> listStaff(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireAdmin(authorization);
        return adminService.listStaff();
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public StaffResponse createStaff(
            @Valid @RequestBody CreateStaffRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireAdmin(authorization);
        return adminService.createStaff(request);
    }
}
