package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.FaceEnrollmentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StudentService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.multipart.MultipartFile;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/students")
public class StudentController {
    private final StudentService studentService;
    private final FaceEnrollmentService faceEnrollmentService;
    private final AuthService authService;

    public StudentController(
            StudentService studentService,
            FaceEnrollmentService faceEnrollmentService,
            AuthService authService
    ) {
        this.studentService = studentService;
        this.faceEnrollmentService = faceEnrollmentService;
        this.authService = authService;
    }

    @GetMapping
    public List<StudentResponse> listStudents(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireTeacher(authorization);
        return studentService.listStudents();
    }

    @GetMapping("/{id}")
    public StudentResponse getStudent(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireSelfOrTeacher(authorization, id);
        return studentService.getStudent(id);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public StudentResponse createStudent(
            @Valid @RequestBody CreateStudentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireAdmin(authorization);
        return studentService.createStudent(request);
    }

    @PutMapping("/{id}")
    public StudentResponse updateStudent(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStudentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireAdmin(authorization);
        return studentService.updateStudent(id, request);
    }

    @PostMapping("/{id}/face-enrollment")
    public FaceEnrollmentResponse enrolFace(
            @PathVariable UUID id,
            @RequestPart("image") MultipartFile image,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireSelfOrTeacher(authorization, id);
        return faceEnrollmentService.enrolFace(id, image);
    }

    @PostMapping("/{id}/face-enrollment/captures")
    public FaceEnrollmentResponse enrolFaceCaptures(
            @PathVariable UUID id,
            @RequestPart("metadata") String metadata,
            @RequestPart("images") List<MultipartFile> images,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireSelfOrTeacher(authorization, id);
        return faceEnrollmentService.enrolFaceCaptures(id, metadata, images);
    }

    @GetMapping("/{id}/face-enrollment/captures")
    public List<FaceEnrollmentCaptureResponse> listFaceEnrollmentCaptures(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireSelfOrTeacher(authorization, id);
        return faceEnrollmentService.listCaptures(id);
    }

    // Served to plain <img src> tags, which can't attach a bearer token — left open like static
    // assets rather than breaking image rendering. The URL is only reachable if the caller already
    // knows the student UUID and capture pose, same trust level as the rest of the AI evidence photos.
    @GetMapping("/{id}/face-enrollment/photo")
    public ResponseEntity<Resource> getFaceEnrollmentPhoto(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(faceEnrollmentService.photoMediaType())
                .body(faceEnrollmentService.getPhoto(id));
    }

    @GetMapping("/{id}/face-enrollment/captures/{pose}/photo")
    public ResponseEntity<Resource> getFaceEnrollmentCapturePhoto(
            @PathVariable UUID id,
            @PathVariable String pose
    ) {
        return ResponseEntity.ok()
                .contentType(faceEnrollmentService.photoMediaType())
                .body(faceEnrollmentService.getCapturePhoto(id, pose));
    }
}
