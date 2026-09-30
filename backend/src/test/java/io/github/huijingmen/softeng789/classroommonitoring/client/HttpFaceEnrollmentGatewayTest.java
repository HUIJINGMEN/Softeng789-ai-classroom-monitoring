package io.github.huijingmen.softeng789.classroommonitoring.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.FaceEnrollmentGateway;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
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
    @Test
    void unavailableAiServiceBlocksRegistrationAndHidesUpstreamHtml() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFaceEnrollmentGateway gateway = new HttpFaceEnrollmentGateway(
                builder, new ObjectMapper(), "http://ai.test");
        String subjectId = "TEST-0001";

        server.expect(requestTo("http://ai.test/face/enroll/captures"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.TEXT_HTML)
                        .body("<!DOCTYPE html><h1>Error 404</h1><p>Pokemon Showdown</p>"));

        AiFaceEnrollmentResponse response = gateway.verifyCaptures(
                subjectId,
                List.of(new FaceEnrollmentGateway.FaceCapture(
                        "front", new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xd9}))
        );

        assertThat(response.studentId()).isEqualTo(subjectId);
        assertThat(response.imageAccepted()).isFalse();
        assertThat(response.aiVerified()).isFalse();
        assertThat(response.status()).isEqualTo("UNAVAILABLE");
        assertThat(response.message()).isEqualTo(
                "Face verification is temporarily unavailable. No registration request was created."
        );
        assertThat(response.message()).doesNotContain("Pokemon").doesNotContain("<!DOCTYPE html>");
        server.verify();
    }
}
