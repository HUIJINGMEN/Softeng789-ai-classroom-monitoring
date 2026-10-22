package io.github.huijingmen.softeng789.classroommonitoring.vision;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class VisionGatewayTest {
    @Test void multipartContractIncludesPrivateCredentialSevenOrderedCapturesAndRoster() throws Exception {
        var request = new AtomicReference<String>();
        var key = new AtomicReference<String>();
        var contentType = new AtomicReference<String>();
        var upgrade = new AtomicReference<String>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v2/face", exchange -> {
            request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            key.set(exchange.getRequestHeaders().getFirst("X-CV-Service-Key"));
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            upgrade.set(exchange.getRequestHeaders().getFirst("Upgrade"));
            byte[] response = "{\"faces\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            var gateway = new VisionGateway(true, "http://127.0.0.1:" + server.getAddress().getPort(), "t".repeat(32),
                    new VisionCrypto("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="));
            gateway.enroll(Collections.nCopies(7, new byte[]{1, 2, 3}));
            assertThat(key.get()).isEqualTo("t".repeat(32));
            assertThat(upgrade.get()).isNull(); // Uvicorn's HTTP/1.1 endpoint does not accept h2c upgrades.
            assertThat(contentType.get()).startsWith("multipart/form-data;boundary=");
            assertThat(request.get().split("name=\"images\"", -1)).hasSize(8);
            assertThat(request.get()).contains("name=\"poses\"", "[\"front\",\"slight_left\",\"left\",\"slight_right\",\"right\",\"chin_up\",\"chin_down\"]");
            gateway.checkCapture(new byte[]{1});
            assertThat(request.get()).contains("name=\"image\"").doesNotContain("name=\"subjects\"", "name=\"poses\"");
            assertThat(gateway.recognize(new byte[]{1}, "[]").path("faces").isArray()).isTrue();
            assertThat(request.get()).contains("name=\"image\"", "name=\"subjects\"");
        } finally { server.stop(0); }
    }

    @Test void enrollmentErrorsExposeOnlyValidatedCaptureDiagnostics() throws Exception {
        var reply = new AtomicReference<String>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v2/face", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = reply.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(422, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        try {
            var gateway = new VisionGateway(true, "http://127.0.0.1:" + server.getAddress().getPort(), "t".repeat(32),
                    new VisionCrypto("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="));
            reply.set("""
                    {"detail":{"code":"ENROLLMENT_CAPTURE_REJECTED","captureNumber":3,"reasons":["BLUR","LIGHTING"]}}
                    """);
            assertThatThrownBy(() -> gateway.enroll(Collections.nCopies(7, new byte[]{1})))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                        assertThat(error.getStatusCode().value()).isEqualTo(422);
                        assertThat(error.getReason()).contains("Capture 3 of 7 (Left)", "blurry", "too dark or too bright", "Retake 3");
                    });
            for (String unsafe : java.util.List.of(
                    "{\"detail\":\"private-internal-detail\"}",
                    "{\"detail\":{\"code\":\"ENROLLMENT_CAPTURE_REJECTED\",\"captureNumber\":0,\"reasons\":[\"BLUR\"]}}",
                    "{\"detail\":{\"code\":\"ENROLLMENT_CAPTURE_REJECTED\",\"captureNumber\":8,\"reasons\":[\"BLUR\"]}}",
                    "{\"detail\":{\"code\":\"ENROLLMENT_CAPTURE_REJECTED\",\"captureNumber\":2,\"reasons\":[\"private-internal-detail\"]}}",
                    "not-json")) {
                reply.set(unsafe);
                assertThatThrownBy(() -> gateway.enroll(Collections.nCopies(7, new byte[]{1})))
                        .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                            assertThat(error.getStatusCode().value()).isEqualTo(422);
                            assertThat(error.getReason()).startsWith("Image or face quality was rejected.")
                                    .doesNotContain("private-internal-detail", "Capture 0", "Capture 8");
                        });
            }
        } finally { server.stop(0); }
    }

    @Test void featureFailsClosedWithoutKeys() {
        var gateway = new VisionGateway(true, "http://127.0.0.1:1", "", new VisionCrypto(""));
        assertThat(gateway.enabled()).isFalse();
        assertThatThrownBy(() -> gateway.recognize(new byte[]{1}, "[]")).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named = "CV_TEST_SERVICE_URL", matches = ".+")
    void realPythonEndpointAcceptsJavaMultipartAndRejectsFacelessEnrollment() throws Exception {
        var gateway = new VisionGateway(true, System.getenv("CV_TEST_SERVICE_URL"), System.getenv("CV_SERVICE_KEY"),
                new VisionCrypto("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="));
        var image = new java.awt.image.BufferedImage(320, 240, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var output = new java.io.ByteArrayOutputStream(); javax.imageio.ImageIO.write(image, "png", output);
        assertThat(gateway.recognize(output.toByteArray(), "[]").path("faces").size()).isZero();
        var check = VisionGateway.captureResult(gateway.checkCapture(output.toByteArray()));
        assertThat(check.accepted()).isFalse(); assertThat(check.reasons()).containsExactly("NO_FACE");
        assertThatThrownBy(() -> gateway.enroll(Collections.nCopies(7, output.toByteArray())))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode().value()).isEqualTo(422);
                    assertThat(error.getReason()).contains("Capture 1 of 7 (Front)", "No face was detected");
                });
    }
}
