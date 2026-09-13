package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ProgressReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.TeacherClassOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentRecognitionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.ProgressReportService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StudentRecognitionService;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
public class ProgressReportController {
    private final ProgressReportService progressReportService;
    private final SessionAuthService sessionAuthService;
    private final StudentRecognitionService studentRecognitionService;

    public ProgressReportController(
            ProgressReportService progressReportService,
            SessionAuthService sessionAuthService,
            StudentRecognitionService studentRecognitionService
    ) {
        this.progressReportService = progressReportService;
        this.sessionAuthService = sessionAuthService;
        this.studentRecognitionService = studentRecognitionService;
    }

    // Called either by the companion mobile app (with a photo) or this web app's StudentProfile
    // page (text-only feedback, photo omitted).
    @PostMapping("/api/progress-reports")
    public ProgressReportResponse createReport(
            @RequestPart("studentId") String studentId,
            @RequestPart("courseOfferingId") String courseOfferingId,
            @RequestPart("comment") String comment,
            @RequestPart(value = "photo", required = false) MultipartFile photo,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return progressReportService.createReport(
                UUID.fromString(studentId), UUID.fromString(courseOfferingId), comment, photo, callerId);
    }

    // Backs StudentProfile.tsx (studentId — a student may be enrolled across several classes),
    // the class detail page's Reports tab (courseOfferingId — every class-wide report list), and
    // the system-wide Reports page (neither — every report the caller can see at all).
    @GetMapping("/api/progress-reports")
    public List<ProgressReportResponse> list(
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) UUID courseOfferingId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        if (studentId != null && courseOfferingId != null) {
            throw new ResponseStatusException(BAD_REQUEST, "Provide only one of studentId or courseOfferingId.");
        }
        if (studentId != null) {
            return progressReportService.listForStudent(studentId, callerId);
        }
        if (courseOfferingId != null) {
            return progressReportService.listForClass(courseOfferingId, callerId);
        }
        return progressReportService.listForCaller(callerId);
    }

    @GetMapping("/api/progress-reports/my-classes")
    public List<TeacherClassOptionResponse> listFeedbackClasses(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return progressReportService.listFeedbackClasses(callerId);
    }

    @PostMapping("/api/progress-reports/recognize-student")
    public StudentRecognitionResponse recognizeStudent(
            @RequestPart("courseOfferingId") String courseOfferingId,
            @RequestPart("photo") MultipartFile photo,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return studentRecognitionService.recognize(UUID.fromString(courseOfferingId), photo, callerId);
    }

    /** Read-only student portal endpoint. Kept separate from the teacher query above so a plain
     * teacher cannot use it to bypass class ownership checks. */
    @GetMapping("/api/students/{studentId}/progress-reports")
    public List<ProgressReportResponse> listForStudentPortal(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return progressReportService.listForStudentPortal(studentId);
    }

    // Served to plain <img src> tags, which can't attach a bearer token — left open like static
    // assets rather than breaking image rendering, the same trust level already accepted for
    // face-enrollment and AI evidence photos elsewhere in this app.
    @GetMapping("/api/progress-reports/{id}/photo")
    public ResponseEntity<Resource> getPhoto(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(progressReportService.getPhoto(id));
    }
}
