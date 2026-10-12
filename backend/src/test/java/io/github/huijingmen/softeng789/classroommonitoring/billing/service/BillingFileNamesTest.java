package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BillingFileNamesTest {
    @Test
    void removesClientPathsAndHeaderControlCharacters() {
        assertThat(BillingFileNames.safeClientName("C:\\fakepath\\receipt\r\n.pdf", "fallback"))
                .isEqualTo("receipt__.pdf");
        assertThat(BillingFileNames.safeClientName("/tmp/evidence.png", "fallback"))
                .isEqualTo("evidence.png");
    }

    @Test
    void usesFallbackForMissingOrDirectoryOnlyNames() {
        assertThat(BillingFileNames.safeClientName(null, "evidence")).isEqualTo("evidence");
        assertThat(BillingFileNames.safeClientName("/", "evidence")).isEqualTo("evidence");
    }

    @Test
    void boundsNamesToTheDatabaseColumnLength() {
        assertThat(BillingFileNames.safeClientName("a".repeat(300), "fallback"))
                .hasSize(255);
        String unicodeName = BillingFileNames.safeClientName("😀".repeat(300), "fallback");
        assertThat(unicodeName.codePointCount(0, unicodeName.length())).isEqualTo(255);
    }
}
