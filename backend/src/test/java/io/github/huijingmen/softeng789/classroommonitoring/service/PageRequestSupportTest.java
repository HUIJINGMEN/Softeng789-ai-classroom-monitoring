package io.github.huijingmen.softeng789.classroommonitoring.service;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageRequestSupportTest {
    @Test
    void createsBoundedPageRequests() {
        var request = PageRequestSupport.create(2, 25, Sort.by(Sort.Order.desc("createdAt")));

        assertThat(request.getPageNumber()).isEqualTo(2);
        assertThat(request.getPageSize()).isEqualTo(25);
        assertThat(request.getSort().getOrderFor("createdAt"))
                .isNotNull()
                .extracting(Sort.Order::getDirection)
                .isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void rejectsInvalidPageAndSizeValues() {
        assertThatThrownBy(() -> PageRequestSupport.create(-1, 20))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("page must be zero or greater");
        assertThatThrownBy(() -> PageRequestSupport.create(0, 0))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("size must be between");
        assertThatThrownBy(() -> PageRequestSupport.create(0, PageRequestSupport.MAX_SIZE + 1))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("size must be between");
    }
}
