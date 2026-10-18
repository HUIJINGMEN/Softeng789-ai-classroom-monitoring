package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Component
public class VisionCrypto {
    private final byte[] key;
    private final SecureRandom random = new SecureRandom();
    public VisionCrypto(@Value("${cv.encryption-key:}") String encodedKey) {
        byte[] decoded;
        try { decoded = Base64.getDecoder().decode(encodedKey); }
        catch (IllegalArgumentException e) { decoded = new byte[0]; }
        key = decoded;
    }
    public boolean configured() { return key.length == 32; }
    public String encrypt(String purpose, String value) {
        checkKey();
        try {
            byte[] nonce = new byte[12]; random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(purpose.getBytes(StandardCharsets.UTF_8));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] result = Arrays.copyOf(nonce, nonce.length + encrypted.length);
            System.arraycopy(encrypted, 0, result, nonce.length, encrypted.length);
            return Base64.getEncoder().encodeToString(result);
        } catch (Exception e) { throw new IllegalStateException("Could not encrypt vision data."); }
    }
    public String decrypt(String purpose, String value) {
        checkKey();
        try {
            byte[] input = Base64.getDecoder().decode(value);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, input, 0, 12));
            cipher.updateAAD(purpose.getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(input, 12, input.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Vision data cannot be decrypted. Contact an administrator."); }
    }
    private void checkKey() {
        if (!configured()) throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Vision encryption is not configured.");
    }
}
