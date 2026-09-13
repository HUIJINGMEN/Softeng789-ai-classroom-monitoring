package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CampusResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RoomResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateRoomRequest;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CampusRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import java.util.List;
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
        "spring.datasource.url=jdbc:h2:mem:room-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class RoomServiceTest {
    @Autowired
    private RoomService roomService;

    @Autowired
    private CampusService campusService;

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
    void createRoomRejectsAnUnknownCampus() {
        assertThatThrownBy(() -> roomService.createRoom(
                new CreateRoomRequest(UUID.randomUUID(), "Room 1", "Room 1", 30)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Campus not found");
    }

    @Test
    void createRoomRejectsADuplicateCodeWithinTheSameCampus() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        assertThatThrownBy(() -> roomService.createRoom(
                new CreateRoomRequest(city.id(), "room 1", "Room One", 25)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already has a room");
    }

    @Test
    void sameRoomCodeCanExistAtDifferentCampuses() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));

        RoomResponse cityRoom = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));
        RoomResponse northRoom = roomService.createRoom(new CreateRoomRequest(north.id(), "Room 1", "Room 1", 30));

        assertThat(cityRoom.id()).isNotEqualTo(northRoom.id());
        assertThat(cityRoom.campusName()).isEqualTo("City");
        assertThat(northRoom.campusName()).isEqualTo("North");
    }

    @Test
    void listRoomsScopedToACampusOnlyReturnsItsOwnRooms() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 2", "Room 2", 30));
        roomService.createRoom(new CreateRoomRequest(north.id(), "Room 1", "Room 1", 30));

        List<RoomResponse> cityRooms = roomService.listRooms(city.id());

        assertThat(cityRooms).extracting("code").containsExactly("Room 1", "Room 2");
        assertThat(cityRooms).allMatch(room -> room.campusId().equals(city.id()));
    }

    @Test
    void listRoomsWithNoCampusFilterReturnsEveryRoomOrderedByCampusThenCode() {
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        roomService.createRoom(new CreateRoomRequest(north.id(), "Room 1", "Room 1", 30));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        List<RoomResponse> allRooms = roomService.listRooms(null);

        assertThat(allRooms).extracting("campusName").containsExactly("City", "North");
    }

    @Test
    void createRoomRejectsABlankCode() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));

        assertThatThrownBy(() -> roomService.createRoom(new CreateRoomRequest(city.id(), "  ", "Room 1", 30)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Room code is required");
    }

    @Test
    void updateRoomChangesItsFields() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        RoomResponse room = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        RoomResponse updated = roomService.updateRoom(
                room.id(), new UpdateRoomRequest(city.id(), "Room 1A", "Renamed Room", 40));

        assertThat(updated.code()).isEqualTo("Room 1A");
        assertThat(updated.name()).isEqualTo("Renamed Room");
        assertThat(updated.capacity()).isEqualTo(40);
    }

    @Test
    void updateRoomCanMoveItToAnotherCampus() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        CampusResponse north = campusService.createCampus(new CreateCampusRequest("North"));
        RoomResponse room = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        RoomResponse updated = roomService.updateRoom(
                room.id(), new UpdateRoomRequest(north.id(), "Room 1", "Room 1", 30));

        assertThat(updated.campusId()).isEqualTo(north.id());
        assertThat(updated.campusName()).isEqualTo("North");
    }

    @Test
    void updateRoomRejectsACodeAlreadyUsedByAnotherRoomAtTheSameCampus() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));
        RoomResponse roomTwo = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 2", "Room 2", 30));

        assertThatThrownBy(() -> roomService.updateRoom(
                roomTwo.id(), new UpdateRoomRequest(city.id(), "room 1", "Room 2", 30)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already has a room");
    }

    @Test
    void updateRoomAllowsKeepingItsOwnUnchangedCode() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        RoomResponse room = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        RoomResponse updated = roomService.updateRoom(
                room.id(), new UpdateRoomRequest(city.id(), "Room 1", "Room 1 Updated", 35));

        assertThat(updated.name()).isEqualTo("Room 1 Updated");
    }

    @Test
    void deleteRoomRemovesIt() {
        CampusResponse city = campusService.createCampus(new CreateCampusRequest("City"));
        RoomResponse room = roomService.createRoom(new CreateRoomRequest(city.id(), "Room 1", "Room 1", 30));

        roomService.deleteRoom(room.id());

        assertThat(roomRepository.findById(room.id())).isEmpty();
    }
}
