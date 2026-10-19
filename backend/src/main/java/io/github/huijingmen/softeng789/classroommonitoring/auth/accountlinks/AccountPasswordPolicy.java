package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import java.nio.charset.StandardCharsets;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

public final class AccountPasswordPolicy {
    private AccountPasswordPolicy() { }
    public static void require(String password) {
        if (password == null || password.isBlank() || password.length() < 8 || password.length() > 72
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Use at least 8 characters, up to 72 UTF-8 bytes, for your password.");
        }
    }
}
