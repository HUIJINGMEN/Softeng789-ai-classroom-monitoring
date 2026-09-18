package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class HttpFaceEnrollmentGatewayTest {
    @TempDir
    Path tempDir;

    @Test
    void unavailableAiServiceKeepsEnrollmentNonBlockingAndHidesUpstreamHtml() throws IOException {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFaceEnrollmentGateway gateway = new HttpFaceEnrollmentGateway(builder, "http://ai.test");
        UUID studentId = UUID.randomUUID();
        Path image = tempDir.resolve("enrollment.jpg");
        Files.write(image, new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xd9});

        server.expect(requestTo("http://ai.test/face/enroll"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.TEXT_HTML)
                        .body("<!DOCTYPE html><h1>Error 404</h1><p>Pokemon Showdown</p>"));

        AiFaceEnrollmentResponse response = gateway.validateFaceEnrollmentImage(studentId, image);

        assertThat(response.studentId()).isEqualTo(studentId.toString());
        assertThat(response.imageAccepted()).isTrue();
        assertThat(response.aiVerified()).isFalse();
        assertThat(response.status()).isEqualTo("PHOTO_CAPTURED");
        assertThat(response.message()).isEqualTo(
                "AI verification is unavailable. The registration photo was saved for later verification."
        );
        assertThat(response.message()).doesNotContain("Pokemon").doesNotContain("<!DOCTYPE html>");
        server.verify();
    }
}
