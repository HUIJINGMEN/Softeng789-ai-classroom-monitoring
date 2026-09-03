package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

/** Minimal, unauthenticated class listing for the student self-registration page. */
public record PublicClassSummaryResponse(UUID id, String courseCode, String offeringCode, String academicTerm) {
}
