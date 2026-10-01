package io.github.huijingmen.softeng789.classroommonitoring.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.FaceEnrollmentGateway;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** HTTP adapter for the development face-enrollment service contract. */
@Component
@ConditionalOnProperty(
        name = "ai.face-enrollment.provider",
        havingValue = "http",
        matchIfMissing = true
)
public class HttpFaceEnrollmentGateway implements FaceEnrollmentGateway {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpFaceEnrollmentGateway.class);
    private static final String UNAVAILABLE_MESSAGE =
            "Face verification is temporarily unavailable. No registration request was created.";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public HttpFaceEnrollmentGateway(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${ai.service.connect-timeout:3s}") Duration connectTimeout,
            @Value("${ai.service.read-timeout:15s}") Duration readTimeout
    ) {
        this(AiServiceRestClientFactory.configure(restClientBuilder, connectTimeout, readTimeout),
                objectMapper, aiServiceUrl);
    }

    HttpFaceEnrollmentGateway(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            String aiServiceUrl
    ) {
        this.restClient = restClientBuilder.baseUrl(aiServiceUrl).build();
        this.objectMapper = objectMapper;
    }

    @Override
    public AiFaceEnrollmentResponse verifyCaptures(String subjectId, List<FaceCapture> captures) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("subject_id", subjectId);
        try {
            body.add("poses", objectMapper.writeValueAsString(captures.stream().map(FaceCapture::pose).toList()));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize face-enrollment poses.", ex);
        }
        for (FaceCapture capture : captures) {
            body.add("images", new NamedByteArrayResource(capture.jpegBytes(), capture.pose() + ".jpg"));
        }

        try {
            AiFaceEnrollmentResponse response = restClient.post()
                    .uri("/face/enroll/captures")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(AiFaceEnrollmentResponse.class);

            if (response == null) {
                LOGGER.warn("Face-enrollment AI service returned an empty response.");
                return unavailable(subjectId);
            }
            return response;
        } catch (RestClientException ex) {
            LOGGER.warn("Face-enrollment AI service is unavailable: {}", ex.getClass().getSimpleName());
            return unavailable(subjectId);
        }
    }

    private static AiFaceEnrollmentResponse unavailable(String subjectId) {
        return new AiFaceEnrollmentResponse(
                subjectId,
                false,
                false,
                "UNAVAILABLE",
                UNAVAILABLE_MESSAGE,
                "HTTP"
        );
    }

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(byte[] bytes, String filename) {
            super(bytes);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }

}
