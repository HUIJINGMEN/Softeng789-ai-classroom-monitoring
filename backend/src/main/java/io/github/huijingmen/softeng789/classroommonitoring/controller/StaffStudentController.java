package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffCreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffCreateStudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffStudentRegistrationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/staff/students")
public class StaffStudentController {
    private final StaffStudentRegistrationService registrationService;
    private final SessionAuthService sessionAuthService;

    public StaffStudentController(
            StaffStudentRegistrationService registrationService,
            SessionAuthService sessionAuthService
    ) {
        this.registrationService = registrationService;
        this.sessionAuthService = sessionAuthService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(CREATED)
    public StaffCreateStudentResponse create(
            @Valid @RequestPart("registration") StaffCreateStudentRequest request,
            @RequestPart("metadata") String metadata,
            @RequestPart("images") List<MultipartFile> images,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return registrationService.create(request, metadata, images, callerId);
    }
}
