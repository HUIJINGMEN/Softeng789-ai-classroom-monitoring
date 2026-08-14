package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class AiServerClient {
    private static final String UNAVAILABLE_MESSAGE =
            "AI verification is unavailable. The registration photo was saved for later verification.";

    private final RestClient restClient;

    public AiServerClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String aiServiceUrl
    ) {
        this.restClient = restClientBuilder.baseUrl(aiServiceUrl).build();
    }

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
                return unavailable(studentId);
            }
            return response;
        } catch (RestClientException ex) {
            return unavailable(studentId);
        }
    }

    private AiFaceEnrollmentResponse unavailable(UUID studentId) {
        return new AiFaceEnrollmentResponse(
                studentId.toString(),
                true,
                false,
                "PHOTO_CAPTURED",
                UNAVAILABLE_MESSAGE
        );
    }
}
