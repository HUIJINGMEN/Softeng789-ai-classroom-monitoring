package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {
    private AuthService authService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new AuthController(authService, mock(SessionAuthService.class)))
                .build();
    }

    @Test
    void acceptsBrowserMultipartContentTypeWithBoundaryAndCharset() throws Exception {
        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        String registrationJson = """
                {
                  "studentNumber": "123456789",
                  "universityEmail": "ana.ngata@aucklanduni.ac.nz",
                  "fullName": "Ana Ngata",
                  "course": "SOFTENG 789",
                  "classOfferingIds": ["%s"],
                  "password": "correct-horse-battery",
                  "consentGiven": true,
                  "level": "LEVEL_1"
                }
                """.formatted(classId);

        MockMultipartFile registration = new MockMultipartFile(
                "registration",
                "registration.json",
                MediaType.APPLICATION_JSON_VALUE,
                registrationJson.getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile metadata = new MockMultipartFile(
                "metadata",
                "",
                MediaType.TEXT_PLAIN_VALUE,
                "[]".getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile image = new MockMultipartFile(
                "images",
                "front.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                new byte[] {1, 2, 3}
        );
        AuthResponse response = new AuthResponse(
                "token",
                SessionAuthService.ROLE_STUDENT,
                studentId,
                "Ana Ngata",
                "ana.ngata@aucklanduni.ac.nz",
                "PENDING"
        );
        when(authService.registerStudent(any(), eq("[]"), anyList())).thenReturn(response);

        mockMvc.perform(multipart("/api/auth/register/student")
                        .file(registration)
                        .file(metadata)
                        .file(image)
                        .contentType(MediaType.parseMediaType(
                                "multipart/form-data;boundary=----WebKitFormBoundaryhUPv36xNcNwdpNVC;charset=UTF-8"
                        )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("token"))
                .andExpect(jsonPath("$.approvalStatus").value("PENDING"));
    }
}
