package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StaffResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AdminServiceTest {
    @Autowired
    private AdminService adminService;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        teacherRepository.deleteAll();
    }

    private StaffResponse createTeacher(String staffNumber, String email) {
        return adminService.createStaff(new CreateStaffRequest(staffNumber, email, "Dr. Dana Kessler", "teacher"));
    }

    @Test
    void newStaffAccountStartsActive() {
        StaffResponse created = createTeacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz");

        assertThat(created.status()).isEqualTo("ACTIVE");
    }

    @Test
    void adminCanDeactivateAndReactivateATeacher() {
        StaffResponse created = createTeacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz");
        UUID actingAdminId = UUID.randomUUID();

        StaffResponse deactivated = adminService.updateStaffStatus(
                created.id(), new UpdateStaffRequest("DEACTIVATED"), actingAdminId);
        assertThat(deactivated.status()).isEqualTo("DEACTIVATED");
        assertThat(teacherRepository.findById(created.id())).get()
                .extracting("status").isEqualTo("DEACTIVATED");

        StaffResponse reactivated = adminService.updateStaffStatus(
                created.id(), new UpdateStaffRequest("ACTIVE"), actingAdminId);
        assertThat(reactivated.status()).isEqualTo("ACTIVE");
    }

    @Test
    void adminCannotDeactivateTheirOwnAccount() {
        StaffResponse selfAccount = createTeacher("UOA-ADMIN", "admin@auckland.ac.nz");

        assertThatThrownBy(() -> adminService.updateStaffStatus(
                selfAccount.id(), new UpdateStaffRequest("DEACTIVATED"), selfAccount.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("cannot deactivate your own account");

        assertThat(teacherRepository.findById(selfAccount.id())).get()
                .extracting("status").isEqualTo("ACTIVE");
    }

    @Test
    void updatingAnUnknownStaffIdIsRejected() {
        assertThatThrownBy(() -> adminService.updateStaffStatus(
                UUID.randomUUID(), new UpdateStaffRequest("DEACTIVATED"), UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void updatingWithAnInvalidStatusValueIsRejected() {
        StaffResponse created = createTeacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz");

        assertThatThrownBy(() -> adminService.updateStaffStatus(
                created.id(), new UpdateStaffRequest("RETIRED"), UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ACTIVE or DEACTIVATED");
    }
}
