package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice(basePackages = "io.github.huijingmen.softeng789.classroommonitoring.kiosk")
@Order(Ordered.HIGHEST_PRECEDENCE)
class KioskExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ProblemDetail> problem(ResponseStatusException error) {
        var body = error.getBody();
        if (!(error instanceof KioskProblem) && error.getStatusCode().value() != 401)
            body.setProperty("code", error.getStatusCode().value() == 403 ? "ACCESS_DENIED" : "VALIDATION_FAILED");
        return ResponseEntity.status(error.getStatusCode()).headers(error.getHeaders()).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(body);
    }
    @ExceptionHandler({org.springframework.web.bind.MissingServletRequestParameterException.class,
            org.springframework.web.bind.MissingRequestHeaderException.class,
            org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<ProblemDetail> validation(Exception error) {
        return problem(new KioskProblem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Provide all required fields in the expected format."));
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> tooLarge(MaxUploadSizeExceededException error) {
        return problem(new KioskProblem(HttpStatus.PAYLOAD_TOO_LARGE, "IMAGE_TOO_LARGE", "The image must be at most 2 MB."));
    }
}
