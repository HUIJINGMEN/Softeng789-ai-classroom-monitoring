package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

final class AccountLinkSecrets {
    private static final SecureRandom RANDOM = new SecureRandom();
    private AccountLinkSecrets() { }
    static String generate() {
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required for account links.", impossible);
        }
    }
    static String fingerprint(String passwordHash) { return digest(passwordHash == null ? "PASSWORDLESS" : passwordHash); }
    static boolean valid(String token) { return token != null && token.matches("[A-Za-z0-9_-]{43}"); }
}
