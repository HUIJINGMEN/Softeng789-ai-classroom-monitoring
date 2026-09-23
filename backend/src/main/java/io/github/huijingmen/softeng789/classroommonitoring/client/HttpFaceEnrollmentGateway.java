package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.FaceEnrollmentGateway;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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
            "AI verification is unavailable. The registration photo was saved for later verification.";

    private final RestClient restClient;

    @Autowired
    public HttpFaceEnrollmentGateway(
            RestClient.Builder restClientBuilder,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${ai.service.connect-timeout:3s}") Duration connectTimeout,
            @Value("${ai.service.read-timeout:15s}") Duration readTimeout
    ) {
        this(configure(restClientBuilder, connectTimeout, readTimeout), aiServiceUrl);
    }

    HttpFaceEnrollmentGateway(RestClient.Builder restClientBuilder, String aiServiceUrl) {
        this.restClient = restClientBuilder.baseUrl(aiServiceUrl).build();
    }

    @Override
    public AiFaceEnrollmentResponse validateFaceEnrollmentImage(UUID studentId, Path imagePath) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("student_id", studentId.toString());
        body.add("image", new FileSystemResource(imagePath));

        try {
            AiFaceEnrollmentResponse response = restClient.post()
                    .uri("/face/enroll")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(AiFaceEnrollmentResponse.class);

            if (response == null) {
                LOGGER.warn("Face-enrollment AI service returned an empty response for student {}.", studentId);
                return unavailable(studentId);
            }
            return response;
        } catch (RestClientException ex) {
            LOGGER.warn("Face-enrollment AI service is unavailable for student {}.", studentId, ex);
            return unavailable(studentId);
        }
    }

    private static AiFaceEnrollmentResponse unavailable(UUID studentId) {
        return new AiFaceEnrollmentResponse(
                studentId.toString(),
                true,
                false,
                "PHOTO_CAPTURED",
                UNAVAILABLE_MESSAGE
        );
    }

    private static RestClient.Builder configure(
            RestClient.Builder builder,
            Duration connectTimeout,
            Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return builder.requestFactory(requestFactory);
    }
}
