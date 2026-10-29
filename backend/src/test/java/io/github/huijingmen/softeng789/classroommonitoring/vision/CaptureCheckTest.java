package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CaptureCheckTest {
    @Test void limitsPerClientAndTotalThenRecoversAfterWindow() {
        var now = new AtomicLong(100_000);
        Clock clock = mock(Clock.class); when(clock.millis()).thenAnswer(call -> now.get());
        var limiter = new CaptureCheckLimiter(clock);
        for (int i = 0; i < 60; i++) limiter.acquire("a");
        assertThatThrownBy(() -> limiter.acquire("a")).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode().value()).isEqualTo(429));
        for (int i = 0; i < 60; i++) limiter.acquire("b");
        assertThatThrownBy(() -> limiter.acquire("c")).isInstanceOf(ResponseStatusException.class);
        now.addAndGet(60_000); limiter.acquire("a"); limiter.acquire("c");
    }
    @Test void gatewayRejectsMalformedOrContradictoryPrecheckResponses() {
        var json = JsonMapper.builder().build();
        for (String body : java.util.List.of("{}", "{\"accepted\":true,\"reasons\":[\"BLUR\"]}",
                "{\"accepted\":false,\"reasons\":[]}", "{\"accepted\":false,\"reasons\":[\"private-error\"]}",
                "{\"accepted\":false,\"reasons\":[\"INCONSISTENT_IDENTITY\"]}")) {
            assertThatThrownBy(() -> VisionGateway.captureResult(json.readTree(body)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageNotContaining("private-error");
        }
        assertThat(VisionGateway.captureResult(json.readTree("{\"accepted\":true,\"reasons\":[]}")).accepted()).isTrue();
        var failure = VisionGateway.captureResult(json.readTree("{\"accepted\":false,\"reasons\":[\"NO_FACE\"]}"));
        assertThat(failure.accepted()).isFalse(); assertThat(failure.message()).contains("No face was detected");
    }
}
