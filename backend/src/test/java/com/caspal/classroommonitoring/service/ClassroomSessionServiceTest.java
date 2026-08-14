package com.caspal.classroommonitoring.service;

import com.caspal.classroommonitoring.dto.CreateClassroomSessionRequest;
import com.caspal.classroommonitoring.entity.ClassroomSession.SessionStatus;
import com.caspal.classroommonitoring.repository.AttendanceRecordRepository;
import com.caspal.classroommonitoring.repository.ClassroomSessionRepository;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:session-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class ClassroomSessionServiceTest {
    @Autowired
    private ClassroomSessionService classroomSessionService;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        classroomSessionRepository.deleteAll();
    }

    @Test
    void scheduledSessionCanStartAndEnd() {
        var created = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                "SOFTENG 789",
                "Room 405-460",
                "Dr. Dana Kessler",
                "d.kessler@auckland.ac.nz",
                "UOA-DKESSLER",
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        ));

        assertThat(created.status()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(created.course()).isEqualTo("SOFTENG 789");
        assertThat(created.courseOfferingId()).isNotNull();
        assertThat(created.roomId()).isNotNull();
        assertThat(created.teacherId()).isNotNull();
        assertThat(created.teacherName()).isEqualTo("Dr. Dana Kessler");

        var started = classroomSessionService.startSession(created.id());
        assertThat(started.status()).isEqualTo(SessionStatus.ACTIVE);

        var completed = classroomSessionService.endSession(created.id());
        assertThat(completed.status()).isEqualTo(SessionStatus.COMPLETED);

        assertThat(classroomSessionRepository.findById(created.id()))
                .get()
                .extracting("status")
                .isEqualTo(SessionStatus.COMPLETED);
    }
}
