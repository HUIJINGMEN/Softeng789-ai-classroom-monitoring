package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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

    public static <S, T> PageResponse<T> from(Page<S> source, Function<S, T> mapper) {
        return from(source, source.getContent().stream().map(mapper).toList());
    }

    /** Builds pagination metadata for directories that must sort an in-memory projection. */
    public static <S, T> PageResponse<T> fromList(
            List<S> source,
            Pageable pageable,
            Function<S, T> mapper
    ) {
        int start = (int) Math.min(pageable.getOffset(), source.size());
        int end = Math.min(start + pageable.getPageSize(), source.size());
        int totalPages = source.isEmpty()
                ? 0
                : (source.size() + pageable.getPageSize() - 1) / pageable.getPageSize();
        List<T> items = source.subList(start, end).stream().map(mapper).toList();
        return new PageResponse<>(
                items,
                pageable.getPageNumber(),
                pageable.getPageSize(),
                source.size(),
                totalPages,
                pageable.getPageNumber() > 0,
                pageable.getPageNumber() + 1 < totalPages
        );
    }
}
