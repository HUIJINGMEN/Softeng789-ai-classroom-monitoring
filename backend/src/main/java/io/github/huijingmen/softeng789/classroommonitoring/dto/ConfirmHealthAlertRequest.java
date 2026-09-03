package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record ConfirmHealthAlertRequest(
        String eventType,
        String teacherNotes,
        String actionTaken
) {
}
