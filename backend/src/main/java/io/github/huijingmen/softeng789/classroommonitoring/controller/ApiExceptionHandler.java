package io.github.huijingmen.softeng789.classroommonitoring.controller;

import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Catches races that slip past application-level checks and turns them into a clean, retryable
 * response instead of a raw 500.
 */
@RestControllerAdvice
public class ApiExceptionHandler {
    /**
     * Two concurrent requests both missing a find-or-create lookup (e.g. a brand-new course code)
     * and colliding on a unique constraint. Deliberately scoped to unique-violation messages only —
     * a CHECK/NOT NULL/foreign-key violation is a real application bug, not a race, and shouldn't
     * be relabelled as one.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrityViolation(DataIntegrityViolationException exception) {
        if (!isUniqueConstraintViolation(exception)) {
            throw exception;
        }
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "That record was just created by someone else. Please try again."
        );
    }

    /** A row (e.g. a pre-provisioned student/teacher) was updated by another request in between. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ProblemDetail handleOptimisticLockFailure(ObjectOptimisticLockingFailureException exception) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "That record was just changed by someone else. Please try again."
        );
    }

    private boolean isUniqueConstraintViolation(Throwable exception) {
        Throwable cause = exception;
        while (cause != null) {
            String message = cause.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains("duplicate key")) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
