package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AttendanceRecordResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
public class AttendanceReviewController {
    private final AttendanceService attendance;
    private final StudentCheckInService checkins;
    private final AttendanceReviewHistory history;
    private final SessionAuthService auth;
    private final StaffAccessService access;
    public AttendanceReviewController(AttendanceService attendance, StudentCheckInService checkins,
            AttendanceReviewHistory history, SessionAuthService auth, StaffAccessService access) {
        this.attendance = attendance; this.checkins = checkins; this.history = history; this.auth = auth; this.access = access;
    }
    public record Workspace(List<AttendanceRecordResponse> attendance, List<StudentCheckInService.RequestView> requests,
            List<AttendanceReviewHistory.Entry> history) {}
    @GetMapping("/api/sessions/{id}/attendance-review")
    public Workspace workspace(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token,
            jakarta.servlet.http.HttpServletResponse response) {
        UUID caller = auth.requireTeacher(token); access.requireSessionAccess(caller, id);
        response.setHeader("Cache-Control", "no-store");
        return new Workspace(attendance.listAttendance(id), checkins.queue(caller, id), history.recent(id));
    }
}
