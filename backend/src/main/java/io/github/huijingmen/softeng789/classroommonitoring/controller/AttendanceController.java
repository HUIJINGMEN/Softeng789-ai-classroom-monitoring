package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AttendanceRecordResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAttendanceHistoryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AttendanceController {
    private final AttendanceService attendanceService;
    private final AuthService authService;

    public AttendanceController(AttendanceService attendanceService, AuthService authService) {
        this.attendanceService = attendanceService;
        this.authService = authService;
    }

    @GetMapping("/api/sessions/{sessionId}/attendance")
    public List<AttendanceRecordResponse> listAttendanceRecords(
            @PathVariable UUID sessionId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireTeacher(authorization);
        return attendanceService.listAttendance(sessionId);
    }

    @GetMapping("/api/students/{studentId}/attendance-history")
    public List<StudentAttendanceHistoryResponse> listAttendanceHistory(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireSelfOrTeacher(authorization, studentId);
        return attendanceService.listAttendanceHistory(studentId);
    }

    @PutMapping("/api/sessions/{sessionId}/attendance/{studentId}")
    public AttendanceRecordResponse updateAttendanceRecord(
            @PathVariable UUID sessionId,
            @PathVariable UUID studentId,
            @Valid @RequestBody UpdateAttendanceRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireTeacher(authorization);
        return attendanceService.updateAttendance(sessionId, studentId, request);
    }
}
