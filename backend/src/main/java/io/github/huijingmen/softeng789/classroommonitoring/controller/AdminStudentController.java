package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.PendingStudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentStatusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StudentService;
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
import org.springframework.web.bind.annotation.RestController;

/** Admin's registration review queue — approving a student activates the account and their requested classes. */
@RestController
@RequestMapping("/api/admin/students")
public class AdminStudentController {
    private final StudentService studentService;
    private final SessionAuthService sessionAuthService;

    public AdminStudentController(StudentService studentService, SessionAuthService sessionAuthService) {
        this.studentService = studentService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/pending")
    public List<PendingStudentResponse> listPendingStudents(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return studentService.listPendingStudents();
    }

    @PostMapping("/{id}/approve")
    public StudentResponse approveStudent(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return studentService.approveStudent(id);
    }

    @PostMapping("/{id}/reject")
    public StudentResponse rejectStudent(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return studentService.rejectStudent(id);
    }

    @PutMapping("/{id}/status")
    public StudentResponse updateStudentStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStudentStatusRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return studentService.updateStudentStatus(id, request);
    }
}
