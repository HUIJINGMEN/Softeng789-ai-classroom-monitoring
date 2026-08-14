package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentRequest;
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

    public StudentController(StudentService studentService, FaceEnrollmentService faceEnrollmentService) {
        this.studentService = studentService;
        this.faceEnrollmentService = faceEnrollmentService;
    }

    @GetMapping
    public List<StudentResponse> listStudents() {
        return studentService.listStudents();
    }

    @GetMapping("/{id}")
    public StudentResponse getStudent(@PathVariable UUID id) {
        return studentService.getStudent(id);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public StudentResponse createStudent(@Valid @RequestBody CreateStudentRequest request) {
        return studentService.createStudent(request);
    }

    @PutMapping("/{id}")
    public StudentResponse updateStudent(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStudentRequest request
    ) {
        return studentService.updateStudent(id, request);
    }

    @PostMapping("/{id}/face-enrollment")
    public FaceEnrollmentResponse enrolFace(
            @PathVariable UUID id,
            @RequestPart("image") MultipartFile image
    ) {
        return faceEnrollmentService.enrolFace(id, image);
    }

    @GetMapping("/{id}/face-enrollment/photo")
    public ResponseEntity<Resource> getFaceEnrollmentPhoto(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(faceEnrollmentService.photoMediaType())
                .body(faceEnrollmentService.getPhoto(id));
    }
}
