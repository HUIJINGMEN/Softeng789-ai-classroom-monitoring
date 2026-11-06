package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class KioskExceptionHandlerTest {
    @ParameterizedTest
    @CsvSource({"400,VALIDATION_FAILED", "403,ACCESS_DENIED", "404,NOT_FOUND", "413,IMAGE_TOO_LARGE",
            "429,RECOGNIZER_BUSY", "502,RECOGNIZER_INVALID_RESPONSE", "503,RECOGNITION_UNAVAILABLE"})
    void mapsSharedExceptionsToTheKioskContract(int status, String code) {
        var response = new KioskExceptionHandler().problem(new ResponseStatusException(HttpStatus.valueOf(status), "Safe detail."));
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody().getProperties()).containsEntry("code", code);
        assertThat(response.getBody().getDetail()).isEqualTo("Safe detail.");
        if (status == 429) assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("2");
    }
    @Test void preservesSpecificKioskErrorsAndSignInRequired() {
        var handler = new KioskExceptionHandler();
        assertThat(handler.problem(new KioskProblem(HttpStatus.TOO_MANY_REQUESTS, "CAPTURE_RATE_LIMITED", "Wait."))
                .getBody().getProperties()).containsEntry("code", "CAPTURE_RATE_LIMITED");
        assertThat(handler.problem(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in required."))
                .getBody().getDetail()).isEqualTo("Sign in required.");
    }
}
