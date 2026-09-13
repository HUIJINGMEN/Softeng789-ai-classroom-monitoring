package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CampusResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CampusRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import java.util.List;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:campus-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class CampusServiceTest {
    @Autowired
    private CampusService campusService;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private CampusRepository campusRepository;

    @BeforeEach
    void cleanDatabase() {
        roomRepository.deleteAll();
        campusRepository.deleteAll();
    }

    @Test
    void createCampusRejectsABlankName() {
        assertThatThrownBy(() -> campusService.createCampus(new CreateCampusRequest("   ")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("required");
    }

    @Test
    void createCampusRejectsADuplicateNameCaseInsensitively() {
        campusService.createCampus(new CreateCampusRequest("City"));

        assertThatThrownBy(() -> campusService.createCampus(new CreateCampusRequest("  city ")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void listCampusesReturnsThemOrderedByNameWithRoomCounts() {
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 2", "Room 2", 30));

        List<CampusResponse> campuses = campusService.listCampuses();

        assertThat(campuses).extracting("name").containsExactly("City", "North");
        assertThat(campuses).extracting("id", "roomCount")
                .containsExactly(
                        Tuple.tuple(city.id(), 2),
                        Tuple.tuple(north.id(), 0));
    }

    @Test
    void updateCampusRenamesIt() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));

        CampusResponse updated = campusService.updateCampus(city.id(), new UpdateCampusRequest("Central"));

        assertThat(updated.name()).isEqualTo("Central");
    }

    @Test
    void updateCampusRejectsRenamingToAnotherCampusExistingName() {
        campusService.createCampus(new CreateCampusRequest("City"));
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));

        assertThatThrownBy(() -> campusService.updateCampus(north.id(), new UpdateCampusRequest("city")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void updateCampusAllowsKeepingItsOwnUnchangedName() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));

        CampusResponse updated = campusService.updateCampus(city.id(), new UpdateCampusRequest("City"));

        assertThat(updated.name()).isEqualTo("City");
    }

    @Test
    void deleteCampusRemovesAnEmptyOne() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));

        campusService.deleteCampus(city.id());

        assertThat(campusRepository.findById(city.id())).isEmpty();
    }

    @Test
    void deleteCampusRejectsOneThatStillHasRooms() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        assertThatThrownBy(() -> campusService.deleteCampus(city.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("room");
        assertThat(campusRepository.findById(city.id())).isPresent();
    }
}
