package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentBankAccount;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentBankAccountRepository extends JpaRepository<PaymentBankAccount, UUID> {
    Optional<PaymentBankAccount> findFirstByActiveTrueOrderByUpdatedAtDesc();
}
