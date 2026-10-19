package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginAttemptStore;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountLinkBoundaryTest {
    @Test void disabledMailNeverClaimsSuccessQueuesWorkOrTouchesBusinessRecords() {
        var links = mock(AccountLinkRepository.class); var budget = mock(LoginAttemptStore.class);
        var disabled = new DisabledAccountLinkMailGateway();
        var requests = new AccountLinkRequests(links, disabled, budget);
        assertThatThrownBy(() -> requests.request("someone@example.test", AccountLinkPurpose.PASSWORD_RESET))
                .isInstanceOfSatisfying(ResponseStatusException.class, failure ->
                        assertThat(failure.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
        verifyNoInteractions(links, budget);
        assertThat(disabled.available()).isFalse();
    }

    @Test void linksUseOnlyCanonicalConfiguredOriginNeverARequestHostOrExternalRedirect() {
        for (String invalid : new String[]{"https://school.test/", "https://school.test/path", "https://user@school.test",
                "https://school.test?redirect=evil", "http://school.test", "https://school.test/#secret"}) {
            assertThatThrownBy(() -> new AccountLinkDelivery(mock(AccountLinkRepository.class),
                    mock(AccountLinkTargets.class), invalid)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatCode(() -> new AccountLinkDelivery(mock(AccountLinkRepository.class), mock(AccountLinkTargets.class), ""))
                .doesNotThrowAnyException();
    }

    @Test void smtpCompositionIsTestedOnlyAgainstAMockNeverAnExternalServer() {
        var sender = mock(JavaMailSender.class);
        new SmtpAccountLinkMailGateway(sender, "accounts@school.test").send("student@example.test",
                AccountLinkPurpose.PASSWORD_RESET, "https://school.test/#account-link=test-only");
        var message = ArgumentCaptor.forClass(SimpleMailMessage.class); verify(sender).send(message.capture());
        assertThat(message.getValue().getFrom()).isEqualTo("accounts@school.test");
        assertThat(message.getValue().getText()).contains("30 minutes", "#account-link=test-only", "did not request");
    }
}
