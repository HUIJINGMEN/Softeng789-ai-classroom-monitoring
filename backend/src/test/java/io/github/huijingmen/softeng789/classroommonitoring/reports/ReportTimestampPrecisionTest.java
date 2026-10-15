package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import static org.assertj.core.api.Assertions.assertThat;

class ReportTimestampPrecisionTest {
    private static final Instant NANOSECOND_TIME = Instant.parse("2026-10-15T04:35:20.488272954Z");
    private static final Instant MICROSECOND_TIME = Instant.parse("2026-10-15T04:35:20.488272Z");

    static Stream<Arguments> metadataFields() {
        var student = new StudentReport();
        var classReport = new ClassReport();
        var overall = new OverallReport();
        return Stream.of(
                Arguments.of("student publication", (Consumer<Instant>) student::setPublishedAt,
                        (Supplier<Instant>) student::getPublishedAt),
                Arguments.of("class finalization", (Consumer<Instant>) classReport::setFinalizedAt,
                        (Supplier<Instant>) classReport::getFinalizedAt),
                Arguments.of("overall finalization", (Consumer<Instant>) overall::setFinalizedAt,
                        (Supplier<Instant>) overall::getFinalizedAt),
                Arguments.of("overall privacy review", (Consumer<Instant>) overall::setPrivacyReviewedAt,
                        (Supplier<Instant>) overall::getPrivacyReviewedAt));
    }

    @ParameterizedTest(name = "{0}: normalize before returning a response")
    @MethodSource("metadataFields")
    void normalizesNanosecondsAtTheEntityBoundary(String field, Consumer<Instant> set, Supplier<Instant> get) {
        set.accept(NANOSECOND_TIME);
        assertThat(get.get()).as(field).isEqualTo(MICROSECOND_TIME);
        set.accept(MICROSECOND_TIME);
        assertThat(get.get()).as("already normalized " + field).isEqualTo(MICROSECOND_TIME);
        set.accept(null);
        assertThat(get.get()).as("unset " + field).isNull();
    }

    @ParameterizedTest(name = "{0}: database round trip preserves exact equality")
    @MethodSource("metadataFields")
    void databaseRoundTripPreservesMetadata(String field, Consumer<Instant> set, Supplier<Instant> get)
            throws SQLException {
        set.accept(NANOSECOND_TIME);
        assertThat(databaseValue(get.get())).as(field).isEqualTo(get.get());
    }

    @Test
    void reportCreationTimesUseDatabasePrecisionAndSurviveRoundTrips() throws SQLException {
        var created = new Instant[] {new StudentReport().getCreatedAt(), new ClassReport().getCreatedAt(),
                new OverallReport().getCreatedAt()};
        for (Instant timestamp : created) {
            assertThat(timestamp.getNano() % 1_000).isZero();
            assertThat(databaseValue(timestamp)).isEqualTo(timestamp);
        }
    }

    private Instant databaseValue(Instant timestamp) throws SQLException {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:report-timestamp-precision", "sa", "");
                var statement = connection.prepareStatement("SELECT CAST(? AS TIMESTAMP(6) WITH TIME ZONE)")) {
            statement.setObject(1, OffsetDateTime.ofInstant(timestamp, ZoneOffset.UTC));
            try (var rows = statement.executeQuery()) {
                assertThat(rows.next()).isTrue();
                return rows.getObject(1, OffsetDateTime.class).toInstant();
            }
        }
    }
}
