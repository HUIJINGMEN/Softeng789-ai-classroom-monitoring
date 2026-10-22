package io.github.huijingmen.softeng789.classroommonitoring.billing.provider;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentMethod;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;

/** Single capability boundary for statement discovery, checkout and the collection adapter. */
@Component
public class PaymentCollectionPolicy {
    public enum CheckoutMode { MANUAL, DEMO }

    private final CheckoutMode mode;

    public PaymentCollectionPolicy(
            @Value("${app.payments.checkout-mode:MANUAL}") CheckoutMode mode,
            Environment environment
    ) {
        if (mode == CheckoutMode.DEMO && (environment.acceptsProfiles(Profiles.of("production | prod"))
                || !environment.acceptsProfiles(Profiles.of("payment-demo")))) {
            throw new IllegalStateException(
                    "Demo checkout requires the payment-demo profile and is forbidden in production.");
        }
        this.mode = mode;
    }

    public boolean demoEnabled() {
        return mode == CheckoutMode.DEMO;
    }

    public List<StudentPaymentMethod> methods() {
        return demoEnabled()
                ? List.of(StudentPaymentMethod.BANK_TRANSFER, StudentPaymentMethod.CASH,
                        StudentPaymentMethod.DEMO_CHECKOUT)
                : List.of(StudentPaymentMethod.BANK_TRANSFER, StudentPaymentMethod.CASH);
    }

    public void requireDemoCheckout() {
        if (!demoEnabled()) {
            throw new ResponseStatusException(FORBIDDEN,
                    "Online checkout is unavailable. Submit a bank transfer or cash payment for staff review.");
        }
    }
}
