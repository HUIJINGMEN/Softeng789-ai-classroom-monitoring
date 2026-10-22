package io.github.huijingmen.softeng789.classroommonitoring.config;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class LegacySchemaAdoptionTest {
    @Test void equivalentRestoredStringArraysMatchButChangedValuesDoNot() {
        String original="CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying])::text[])))";
        String restored="CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text])))";
        assertThat(LegacySchemaAdoption.canonical(restored)).isEqualTo(LegacySchemaAdoption.canonical(original));
        assertThat(LegacySchemaAdoption.canonical(restored.replace("APPROVED","REJECTED")))
                .isNotEqualTo(LegacySchemaAdoption.canonical(original));
        assertThat(LegacySchemaAdoption.canonical("FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE"))
                .isNotEqualTo(LegacySchemaAdoption.canonical("FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL"));
        assertThat(LegacySchemaAdoption.canonical("CREATE UNIQUE INDEX ON packages(id) WHERE status='ACTIVE'::text"))
                .isNotEqualTo(LegacySchemaAdoption.canonical("CREATE UNIQUE INDEX ON packages(id)"));
    }
}
