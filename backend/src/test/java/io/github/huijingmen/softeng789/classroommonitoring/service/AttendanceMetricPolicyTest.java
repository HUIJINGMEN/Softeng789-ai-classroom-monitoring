package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AttendanceMetricPolicyTest {
    @Test
    void missingAbsenceAndEmptyEvidenceAreDistinctAndInvalidCountsFailFast() {
        assertThat(AttendanceMetricPolicy.recorded(AttendanceStatus.UNKNOWN)).isFalse();
        assertThat(AttendanceMetricPolicy.recorded(AttendanceStatus.ABSENT)).isTrue();
        assertThat(AttendanceMetricPolicy.rate(24, 26)).isEqualTo(92);
        assertThat(AttendanceMetricPolicy.rate(0, 0)).isNull();
        assertThat(AttendanceMetricPolicy.rate(0, 3)).isZero();
        assertThatThrownBy(() -> AttendanceMetricPolicy.rate(3, 2)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> AttendanceMetricPolicy.rate(-1, 2)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void completedEvidenceUsesSchoolDateAndRealInstantNotJustALifecycleFlag() {
        var session = new ClassroomSession();
        session.setDate(LocalDate.of(2026, 10, 17));
        session.setStartTime(Instant.parse("2026-10-16T21:00:00Z"));
        session.setStatus(ClassroomSession.SessionStatus.COMPLETED);
        assertThat(AttendanceMetricPolicy.completedBy(session, Instant.parse("2026-10-16T21:01:00Z"))).isTrue();
        assertThat(AttendanceMetricPolicy.completedBy(session, Instant.parse("2026-10-16T20:59:00Z"))).isFalse();
        for (var status : ClassroomSession.SessionStatus.values()) {
            session.setStatus(status);
            assertThat(AttendanceMetricPolicy.completedBy(session, Instant.parse("2026-10-17T03:00:00Z")))
                    .isEqualTo(status == ClassroomSession.SessionStatus.COMPLETED);
        }
    }
}
