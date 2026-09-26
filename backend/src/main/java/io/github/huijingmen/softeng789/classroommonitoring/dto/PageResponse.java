package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import org.springframework.data.domain.Page;

/** Stable API pagination metadata without exposing Spring Data's internal JSON shape. */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasPrevious,
        boolean hasNext
) {
    public static <T> PageResponse<T> from(Page<?> source, List<T> items) {
        return new PageResponse<>(
                List.copyOf(items),
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.hasPrevious(),
                source.hasNext()
        );
    }
}
