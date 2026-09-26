package io.github.huijingmen.softeng789.classroommonitoring.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Shared limits for public list endpoints so one request cannot load an unbounded result set. */
final class PageRequestSupport {
    static final int MAX_SIZE = 100;

    private PageRequestSupport() {
    }

    static PageRequest create(int page, int size) {
        return create(page, size, Sort.unsorted());
    }

    static PageRequest create(int page, int size, Sort sort) {
        if (page < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "page must be zero or greater.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    "size must be between 1 and " + MAX_SIZE + "."
            );
        }
        return PageRequest.of(page, size, sort);
    }
}
