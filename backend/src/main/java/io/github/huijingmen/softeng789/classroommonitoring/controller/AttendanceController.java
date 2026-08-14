package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AttendanceRecordResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AttendanceController {
    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping("/api/sessions/{sessionId}/attendance")
    public List<AttendanceRecordResponse> listAttendanceRecords(@PathVariable UUID sessionId) {
        return attendanceService.listAttendance(sessionId);
    }

    @PutMapping("/api/sessions/{sessionId}/attendance/{studentId}")
    public AttendanceRecordResponse updateAttendanceRecord(
            @PathVariable UUID sessionId,
            @PathVariable UUID studentId,
            @Valid @RequestBody UpdateAttendanceRequest request
    ) {
        return attendanceService.updateAttendance(sessionId, studentId, request);
    }
}
