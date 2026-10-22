package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Private, bounded CPU service. No browser credentials or student names leave Spring. */
@Component
public class VisionGateway {
    private static final String QUALITY_FALLBACK = "Image or face quality was rejected. Use clear, well-lit images with the required faces and poses; recapture and retry.";
    private static final JsonMapper ERROR_JSON = JsonMapper.builder().build();
    private static final List<String> CAPTURE_LABELS = List.of("Front", "Slight left", "Left", "Slight right", "Right", "Look up", "Look down");
    private static final Map<String, String> CAPTURE_REASONS = Map.of(
            "NO_FACE", "No face was detected. Face the camera more directly and keep both eyes visible.",
            "MULTIPLE_FACES", "More than one face was detected. Keep only yourself in the frame.",
            "FACE_TOO_SMALL", "Your face is too small in the image. Move closer to the camera.",
            "BLUR", "The face image is blurry. Hold still and wait for the camera to focus.",
            "LIGHTING", "The face is too dark or too bright. Use even light from in front of you.",
            "INCONSISTENT_IDENTITY", "This capture did not match capture 1 (Front) closely enough. Turn less and keep both eyes visible; check that the front capture is clear.",
            "INVALID_IMAGE", "The image could not be read. Capture a new photo.");
    private final RestClient client;
    private final boolean enabled;
    private final String serviceKey;
    private final VisionCrypto crypto;
    public VisionGateway(@Value("${cv.enabled:false}") boolean enabled,
            @Value("${cv.service-url:http://127.0.0.1:8000}") String url,
            @Value("${cv.service-key:}") String serviceKey, VisionCrypto crypto) {
        this.enabled = enabled; this.serviceKey = serviceKey; this.crypto = crypto;
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(90));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    public boolean enabled() { return enabled && serviceKey.length() >= 32 && crypto.configured(); }
    public void requireEnabled() {
        if (!enabled()) throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Photo attendance is not configured. Use manual attendance.");
    }
    public JsonNode enroll(List<byte[]> images) {
        var body = new LinkedMultiValueMap<String, Object>();
        body.add("poses", "[\"front\",\"slight_left\",\"left\",\"slight_right\",\"right\",\"chin_up\",\"chin_down\"]");
        for (int i = 0; i < images.size(); i++) body.add("images", resource(images.get(i), "capture-" + i + ".jpg"));
        return call("/v2/face/enroll", body);
    }
    public JsonNode recognize(byte[] photo, String subjects) {
        var body = new LinkedMultiValueMap<String, Object>();
        body.add("subjects", subjects); body.add("image", resource(photo, "classroom.jpg"));
        return call("/v2/face/recognize", body);
    }
    public JsonNode checkCapture(byte[] photo) {
        var body = new LinkedMultiValueMap<String, Object>();
        body.add("image", resource(photo, "capture.jpg"));
        return call("/v2/face/check-capture", body);
    }
    public record CaptureCheck(boolean accepted, List<String> reasons, String message) {}
    static CaptureCheck captureResult(JsonNode result) {
        if (result == null || !result.path("accepted").isBoolean() || !result.path("reasons").isArray()
                || result.path("reasons").size() > 3) throw invalidCaptureResult();
        var reasons = new ArrayList<String>();
        var messages = new ArrayList<String>();
        for (JsonNode reason : result.path("reasons")) {
            String code = reason.asText();
            if (!reason.isTextual() || !CAPTURE_REASONS.containsKey(code) || "INCONSISTENT_IDENTITY".equals(code))
                throw invalidCaptureResult();
            reasons.add(code); messages.add(CAPTURE_REASONS.get(code));
        }
        boolean accepted = result.path("accepted").asBoolean();
        if (accepted != reasons.isEmpty()) throw invalidCaptureResult();
        return new CaptureCheck(accepted, List.copyOf(reasons), accepted
                ? "Photo quality passed. Identity is checked when all seven photos are submitted."
                : String.join(" ", messages));
    }
    private static ResponseStatusException invalidCaptureResult() {
        return new ResponseStatusException(SERVICE_UNAVAILABLE, "Photo validation is unavailable. Try again or use manual attendance.");
    }
    private ByteArrayResource resource(byte[] bytes, String name) {
        return new ByteArrayResource(bytes) { @Override public String getFilename() { return name; } };
    }
    private String enrollmentRejection(String path, RestClientResponseException error) {
        // Only translate the bounded diagnostic contract. Never expose arbitrary upstream text.
        if (!"/v2/face/enroll".equals(path)) return QUALITY_FALLBACK;
        try {
            String body = error.getResponseBodyAsString();
            if (body.length() > 4096) return QUALITY_FALLBACK;
            JsonNode detail = ERROR_JSON.readTree(body).path("detail");
            JsonNode number = detail.path("captureNumber");
            JsonNode reasons = detail.path("reasons");
            if (!"ENROLLMENT_CAPTURE_REJECTED".equals(detail.path("code").asText())
                    || !number.isIntegralNumber() || !number.canConvertToInt()
                    || number.asInt() < 1 || number.asInt() > 7
                    || !reasons.isArray() || reasons.isEmpty() || reasons.size() > 3) return QUALITY_FALLBACK;
            var messages = new ArrayList<String>();
            for (JsonNode reason : reasons) {
                String message = CAPTURE_REASONS.get(reason.asText());
                if (message == null) return QUALITY_FALLBACK;
                if (!messages.contains(message)) messages.add(message);
            }
            int capture = number.asInt();
            return "Capture " + capture + " of 7 (" + CAPTURE_LABELS.get(capture - 1) + "): "
                    + String.join(" ", messages) + " Use Retake " + capture + " to replace this photo, then submit again. Only the first failing capture is shown.";
        } catch (Exception ignored) {
            return QUALITY_FALLBACK;
        }
    }

    private JsonNode call(String path, LinkedMultiValueMap<String, Object> body) {
        requireEnabled();
        try {
            JsonNode response = client.post().uri(path).header("X-CV-Service-Key", serviceKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(body).retrieve().body(JsonNode.class);
            if (response == null) throw new IllegalStateException();
            return response;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 422) throw new ResponseStatusException(UNPROCESSABLE_ENTITY,
                    enrollmentRejection(path, e));
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Face recognition is unavailable. No attendance was changed; use manual attendance.");
        } catch (Exception e) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Face recognition timed out or failed. No attendance was changed; use manual attendance.");
        }
    }
}
