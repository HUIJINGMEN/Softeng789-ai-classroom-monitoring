package io.github.huijingmen.softeng789.classroommonitoring.vision;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
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
    private ByteArrayResource resource(byte[] bytes, String name) {
        return new ByteArrayResource(bytes) { @Override public String getFilename() { return name; } };
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
                    "Image or face quality was rejected. Use clear, well-lit images with the required faces and poses; recapture and retry.");
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Face recognition is unavailable. No attendance was changed; use manual attendance.");
        } catch (Exception e) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Face recognition timed out or failed. No attendance was changed; use manual attendance.");
        }
    }
}
