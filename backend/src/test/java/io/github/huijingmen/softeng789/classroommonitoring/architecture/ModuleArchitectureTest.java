package io.github.huijingmen.softeng789.classroommonitoring.architecture;

import io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewService;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import static org.assertj.core.api.Assertions.assertThat;

/** Structural checks only: no application startup, database access or extra architecture library. */
class ModuleArchitectureTest {
    private static final String BASE = "io.github.huijingmen.softeng789.classroommonitoring";

    @Test
    void serviceAndComponentInjectionDependenciesStayAcyclic() throws Exception {
        Set<Class<?>> beans = applicationComponents();
        assertThat(beans).contains(StudentOverviewService.class);
        Map<Class<?>, Set<Class<?>>> graph = new LinkedHashMap<>();
        for (Class<?> bean : beans) {
            Set<Class<?>> dependencies = new LinkedHashSet<>();
            for (Class<?> type : injectionTypes(bean)) {
                beans.stream().filter(type::isAssignableFrom).forEach(dependencies::add);
            }
            graph.put(bean, dependencies);
        }
        Set<Class<?>> visited = new HashSet<>();
        for (Class<?> bean : beans) visit(bean, graph, visited, new ArrayList<>());
    }

    @Test
    void applicationServicesDoNotDependOnWebAdapters() throws Exception {
        for (Class<?> bean : applicationComponents()) {
            for (Class<?> dependency : injectionTypes(bean)) {
                if (!dependency.getPackageName().startsWith(BASE + ".")) continue;
                assertThat(dependency.getPackageName()).as("%s -> %s", bean.getName(), dependency.getName())
                        .doesNotContain(".controller", ".web");
            }
        }
    }

    @Test
    void calculationPoliciesAndProjectionsStayStatelessAndOutsideSpring() throws Exception {
        for (String name : List.of("billing.service.InvoiceStatusPolicy", "billing.service.InvoiceCourseAllocation",
                "billing.service.BillingCourseProjection", "studentoverview.StudentOverviewProjection",
                "service.AttendanceMetricPolicy", "service.AttendanceRosterPolicy")) {
            Class<?> type = Class.forName(BASE + "." + name);
            assertThat(type.isAnnotationPresent(Service.class)).as(name).isFalse();
            assertThat(type.isAnnotationPresent(Component.class)).as(name).isFalse();
            assertThat(Arrays.stream(type.getDeclaredFields()).allMatch(field -> Modifier.isStatic(field.getModifiers())))
                    .as("%s cannot hold injected services or mutable instance state", name).isTrue();
            assertThat(Arrays.stream(type.getDeclaredMethods()).allMatch(method -> Modifier.isStatic(method.getModifiers())))
                    .as("%s exposes pure static calculations", name).isTrue();
        }
    }

    private Set<Class<?>> applicationComponents() throws Exception {
        var resolver = new PathMatchingResourcePatternResolver();
        var metadata = new CachingMetadataReaderFactory(resolver);
        Set<Class<?>> classes = new LinkedHashSet<>();
        for (var resource : resolver.getResources("classpath*:" + BASE.replace('.', '/') + "/**/*.class")) {
            if (resource.getURL().toString().contains("/test-classes/")) continue;
            var reader = metadata.getMetadataReader(resource);
            var annotations = reader.getAnnotationMetadata();
            if (annotations.hasAnnotation(Service.class.getName()) || annotations.hasAnnotation(Component.class.getName())) {
                classes.add(Class.forName(reader.getClassMetadata().getClassName(), false, getClass().getClassLoader()));
            }
        }
        return classes;
    }

    private List<Class<?>> injectionTypes(Class<?> type) {
        return Stream.concat(
                Arrays.stream(type.getDeclaredFields()).filter(field -> !Modifier.isStatic(field.getModifiers()))
                        .map(field -> field.getType()),
                Arrays.stream(type.getDeclaredConstructors()).flatMap(constructor -> Arrays.stream(constructor.getParameterTypes()))
        ).distinct().toList();
    }

    private void visit(Class<?> bean, Map<Class<?>, Set<Class<?>>> graph, Set<Class<?>> visited, List<Class<?>> path) {
        assertThat(path).as("Circular dependency: %s -> %s", path, bean.getName()).doesNotContain(bean);
        if (!visited.add(bean)) return;
        path.add(bean);
        for (Class<?> dependency : graph.getOrDefault(bean, Set.of())) visit(dependency, graph, visited, path);
        path.removeLast();
    }
}
