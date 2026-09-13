package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassStudentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RemoveClassStudentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.TransferStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AdminClassService;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassRosterService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import static org.springframework.http.HttpStatus.NO_CONTENT;

@RestController
@RequestMapping("/api/admin/classes")
public class AdminClassController {
    private final AdminClassService adminClassService;
    private final ClassRosterService classRosterService;
    private final SessionAuthService sessionAuthService;

    public AdminClassController(
            AdminClassService adminClassService,
            ClassRosterService classRosterService,
            SessionAuthService sessionAuthService
    ) {
        this.adminClassService = adminClassService;
        this.classRosterService = classRosterService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<ClassResponse> listClasses(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminClassService.listClasses();
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public ClassResponse createClass(
            @Valid @RequestBody CreateClassRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminClassService.createClass(request);
    }

    @PutMapping("/{id}")
    public ClassResponse updateClass(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateClassRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminClassService.updateClass(id, request);
    }

    @PostMapping("/{id}/teachers")
    public ClassResponse addTeacher(
            @PathVariable UUID id,
            @Valid @RequestBody AddClassTeacherRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminClassService.addTeacher(id, request);
    }

    @DeleteMapping("/{id}/teachers/{teacherId}")
    public ClassResponse removeTeacher(
            @PathVariable UUID id,
            @PathVariable UUID teacherId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return adminClassService.removeTeacher(id, teacherId);
    }

    @GetMapping("/{id}/students")
    public List<StudentResponse> listStudents(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return classRosterService.listStudents(id);
    }

    @PostMapping("/{id}/students")
    @ResponseStatus(CREATED)
    public void addStudent(
            @PathVariable UUID id,
            @Valid @RequestBody AddClassStudentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        classRosterService.addStudent(id, request);
    }

    @DeleteMapping("/{id}/students/{studentId}")
    @ResponseStatus(NO_CONTENT)
    public void removeStudent(
            @PathVariable UUID id,
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        classRosterService.removeStudent(id, studentId);
    }

    @PostMapping("/{id}/students/batch")
    @ResponseStatus(CREATED)
    public ClassResponse addStudents(
            @PathVariable UUID id,
            @Valid @RequestBody AddClassStudentsRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return classRosterService.addStudents(id, request);
    }

    @PostMapping("/{id}/students/batch-withdraw")
    @ResponseStatus(NO_CONTENT)
    public void removeStudents(
            @PathVariable UUID id,
            @Valid @RequestBody RemoveClassStudentsRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        classRosterService.removeStudents(id, request);
    }

    @PostMapping("/{id}/students/{studentId}/transfer")
    @ResponseStatus(NO_CONTENT)
    public void transferStudent(
            @PathVariable UUID id,
            @PathVariable UUID studentId,
            @Valid @RequestBody TransferStudentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        classRosterService.transferStudent(studentId, id, request.toClassId());
    }
}
