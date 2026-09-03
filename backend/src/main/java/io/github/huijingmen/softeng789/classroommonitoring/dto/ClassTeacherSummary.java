package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record ClassTeacherSummary(UUID id, String name, String email, String status) {
}
