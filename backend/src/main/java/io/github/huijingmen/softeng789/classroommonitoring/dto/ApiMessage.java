package io.github.huijingmen.softeng789.classroommonitoring.dto;

public record ApiMessage(String status, String service, String message) {
    public static ApiMessage placeholder(String resource) {
        return new ApiMessage("placeholder", "backend", resource + " API skeleton is ready");
    }
}
