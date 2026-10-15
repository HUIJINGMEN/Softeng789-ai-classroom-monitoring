package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student-reports/workspace")
public class StudentReportWorkspaceController {
    private final StudentReportWorkspace workspace;
    private final SessionAuthService auth;
    public StudentReportWorkspaceController(StudentReportWorkspace workspace, SessionAuthService auth) {
        this.workspace = workspace; this.auth = auth;
    }
    @PostMapping
    public List<StudentReportWorkspace.Row> list(@Valid @RequestBody StudentReportWorkspace.Request request,
                                                @RequestHeader("Authorization") String token) {
        return workspace.list(request, auth.requireTeacher(token));
    }
}
