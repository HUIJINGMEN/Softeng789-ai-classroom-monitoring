package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProtectedMediaServiceTest {
    private final ProtectedMediaService service = new ProtectedMediaService();

    @Test
    void issuedGrantOnlyAuthorisesItsExactResource() {
        UUID studentId = UUID.randomUUID();
        String url = service.facePhotoUrl(studentId);
        String token = url.substring(url.indexOf("access=") + "access=".length());

        assertThat(url).startsWith("/api/students/" + studentId + "/face-enrollment/photo?access=");
        assertThatCode(() -> service.requireFacePhoto(token, studentId)).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.requireFacePhoto(token, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("invalid or has expired");
    }

    @Test
    void missingGrantIsRejected() {
        assertThatThrownBy(() -> service.requireProgressReportPhoto(null, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("invalid or has expired");
    }
}
