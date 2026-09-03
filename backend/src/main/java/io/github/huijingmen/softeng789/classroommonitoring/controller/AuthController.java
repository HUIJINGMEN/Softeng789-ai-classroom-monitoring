package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.NO_CONTENT;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final SessionAuthService sessionAuthService;

    public AuthController(AuthService authService, SessionAuthService sessionAuthService) {
        this.authService = authService;
        this.sessionAuthService = sessionAuthService;
    }

    @PostMapping("/register/student")
    @ResponseStatus(CREATED)
    public AuthResponse registerStudent(@Valid @RequestBody RegisterStudentRequest request) {
        return authService.registerStudent(request);
    }

    @PostMapping("/register/teacher")
    @ResponseStatus(CREATED)
    public AuthResponse registerTeacher(@Valid @RequestBody RegisterTeacherRequest request) {
        return authService.registerTeacher(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public AuthResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return authService.me(sessionAuthService.extractToken(authorization));
    }

    @PostMapping("/logout")
    @ResponseStatus(NO_CONTENT)
    public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        sessionAuthService.logout(sessionAuthService.extractToken(authorization));
    }
}
