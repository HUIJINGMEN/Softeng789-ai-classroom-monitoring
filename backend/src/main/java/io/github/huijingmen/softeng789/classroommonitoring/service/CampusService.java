package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CampusResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateCampusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Campus;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CampusRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class CampusService {
    private final CampusRepository campusRepository;
    private final RoomRepository roomRepository;

    public CampusService(CampusRepository campusRepository, RoomRepository roomRepository) {
        this.campusRepository = campusRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<CampusResponse> listCampuses() {
        return campusRepository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public CampusResponse createCampus(CreateCampusRequest request) {
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Campus name is required.");
        }
        if (campusRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "A campus with that name already exists.");
        }
        Campus campus = new Campus();
        campus.setName(name);
        return toResponse(campusRepository.save(campus));
    }

    @Transactional
    public CampusResponse updateCampus(UUID id, UpdateCampusRequest request) {
        Campus campus = findEntity(id);
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Campus name is required.");
        }
        campusRepository.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(CONFLICT, "A campus with that name already exists.");
            }
        });
        campus.setName(name);
        return toResponse(campusRepository.save(campus));
    }

    // Rooms hold the real FK (ON DELETE RESTRICT) — checking here first turns what would
    // otherwise be a raw constraint violation into a clear, actionable message instead.
    @Transactional
    public void deleteCampus(UUID id) {
        Campus campus = findEntity(id);
        long roomCount = roomRepository.countByCampus_Id(id);
        if (roomCount > 0) {
            throw new ResponseStatusException(CONFLICT,
                    "This campus still has " + roomCount + " room(s). Remove them first.");
        }
        campusRepository.delete(campus);
    }

    Campus findEntity(UUID id) {
        return campusRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Campus not found."));
    }

    private CampusResponse toResponse(Campus campus) {
        long roomCount = roomRepository.countByCampus_Id(campus.getId());
        return new CampusResponse(campus.getId(), campus.getName(), (int) roomCount);
    }
}
