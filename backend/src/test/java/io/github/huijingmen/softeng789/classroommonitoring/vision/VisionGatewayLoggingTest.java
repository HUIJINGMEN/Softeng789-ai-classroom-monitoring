package io.github.huijingmen.softeng789.classroommonitoring.vision;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.LoggerFactory;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.*;

@ResourceLock("spring-web-logging")
class VisionGatewayLoggingTest {
    private static final String SERVICE_KEY = "synthetic-cv-service-key-not-for-logs";
    private static final String STUDENT_ID = "e46cdcf1-44dd-4903-8073-55bc44acf304";
    private static final String TEMPLATE_VALUE = "0.123456789012345";
    private static final String PHOTO = "synthetic-private-photo-bytes";
    private static final String SUBJECTS = "[{\"studentId\":\"" + STUDENT_ID
            + "\",\"modelVersion\":\"test\",\"templates\":[[" + TEMPLATE_VALUE + "]]}]";

    @ParameterizedTest
    @CsvSource({"DEBUG,200", "TRACE,200", "DEBUG,422", "TRACE,422", "DEBUG,503", "TRACE,503"})
    void privatePayloadsReachServiceButNeverSpringLogs(String level, int status) throws Exception {
        var request = new AtomicReference<String>();
        var credential = new AtomicReference<String>();
        String response = "{\"templates\":[[" + TEMPLATE_VALUE + "]],\"detail\":\"" + PHOTO + "\"}";
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v2/face", exchange -> {
            request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            credential.set(exchange.getRequestHeaders().getFirst("X-CV-Service-Key"));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        Logger logger = (Logger) LoggerFactory.getLogger("org.springframework.web");
        Level previousLevel = logger.getLevel();
        boolean previousAdditive = logger.isAdditive();
        var logs = new ListAppender<ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        logger.setAdditive(false);
        logger.setLevel(Level.toLevel(level));
        server.start();
        try {
            var gateway = new VisionGateway(true, "http://127.0.0.1:" + server.getAddress().getPort(),
                    SERVICE_KEY, new VisionCrypto("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="));
            byte[] photo = PHOTO.getBytes(StandardCharsets.UTF_8);
            assertResult(() -> gateway.recognize(photo, SUBJECTS), status);
            assertThat(request.get()).contains(SUBJECTS, PHOTO, "name=\"subjects\"", "name=\"image\"");
            assertThat(credential.get()).isEqualTo(SERVICE_KEY);

            assertResult(() -> gateway.enroll(Collections.nCopies(7, photo)), status);
            assertThat(request.get()).contains(PHOTO, "name=\"poses\"");
            assertThat(request.get().split("name=\"images\"", -1)).hasSize(8);
            assertResult(() -> gateway.checkCapture(photo), status);
            assertThat(request.get()).contains(PHOTO, "name=\"image\"");

            // Ensure logging really ran; an empty capture must not make this test pass.
            assertThat(logs.list).anySatisfy(event -> {
                assertThat(event.getLoggerName()).contains("DefaultRestClient");
                assertThat(event.getFormattedMessage()).contains("Writing [");
            });
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage())
                        .doesNotContain(SUBJECTS, STUDENT_ID, TEMPLATE_VALUE, PHOTO, SERVICE_KEY);
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {
            server.stop(0);
            logger.detachAppender(logs);
            logger.setLevel(previousLevel);
            logger.setAdditive(previousAdditive);
            logs.stop();
        }
    }

    private static void assertResult(Supplier<JsonNode> call, int status) {
        if (status == 200) {
            assertThat(call.get().path("templates").get(0).get(0).asText()).isEqualTo(TEMPLATE_VALUE);
            return;
        }
        assertThatThrownBy(call::get).isInstanceOfSatisfying(ResponseStatusException.class, error -> {
            assertThat(error.getStatusCode().value()).isEqualTo(status);
            assertThat(error.getReason()).doesNotContain(STUDENT_ID, TEMPLATE_VALUE, PHOTO, SERVICE_KEY);
        });
    }
}
