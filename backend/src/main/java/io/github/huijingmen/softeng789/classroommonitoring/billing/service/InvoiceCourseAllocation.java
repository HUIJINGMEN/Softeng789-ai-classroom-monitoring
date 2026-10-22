package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.*;

/** Read-only proportional attribution, not a ledger write or a change to a student's debt.
 * Allocate integer cents over ALL charge lines (including unlinked fees). Largest remainders
 * preserve the exact signed amount after discounts, partial payments, refunds and penny splits.
 */
final class InvoiceCourseAllocation {
    private InvoiceCourseAllocation() { }
    record Result(Map<UUID, BigDecimal> courses, BigDecimal unassigned) { }
    private record Share(UUID course, BigInteger cents, BigInteger remainder, int order) { }

    static Result allocate(StudentInvoice invoice, BigDecimal amount) {
        var weights = weights(invoice);
        BigInteger total = weights.values().stream().reduce(BigInteger.ZERO, BigInteger::add);
        if (total.signum() == 0) return new Result(Map.of(), InvoiceAmounts.money(amount));
        BigInteger cents = minor(amount).abs();
        var shares = shares(weights, cents, total);
        var extra = remainderRecipients(shares, cents);
        Map<UUID, BigDecimal> courses = new LinkedHashMap<>();
        BigDecimal unassigned = BigDecimal.ZERO.setScale(2);
        for (var share : shares) {
            BigInteger value = share.cents().add(extra.contains(share.order()) ? BigInteger.ONE : BigInteger.ZERO);
            var allocated = new BigDecimal(value.multiply(BigInteger.valueOf(amount.signum())), 2);
            if (share.course() == null) unassigned = allocated;
            else courses.put(share.course(), allocated);
        }
        return new Result(Collections.unmodifiableMap(courses), unassigned);
    }

    private static Map<UUID, BigInteger> weights(StudentInvoice invoice) {
        var weights = new LinkedHashMap<UUID, BigInteger>();
        var entitlements = invoice.getEntitlements();
        var legacyCourse = entitlements.size() == 1 && entitlements.getFirst().getLineItem() == null
                ? entitlements.getFirst().getCourseOffering().getId() : null;
        for (var line : invoice.getLineItems()) {
            if (line.getType() != LineItemType.CHARGE || line.getAmount().signum() <= 0) continue;
            var linked = entitlements.stream().filter(row -> sameLine(line, row.getLineItem()))
                    .map(row -> row.getCourseOffering().getId()).distinct().toList();
            UUID course = linked.size() == 1 ? linked.getFirst() : legacyCourse;
            weights.merge(course, minor(line.getAmount()), BigInteger::add);
        }
        return weights;
    }

    private static List<Share> shares(Map<UUID, BigInteger> weights, BigInteger cents, BigInteger total) {
        List<Share> shares = new ArrayList<>();
        weights.forEach((course, weight) -> {
            var split = cents.multiply(weight).divideAndRemainder(total);
            shares.add(new Share(course, split[0], split[1], shares.size()));
        });
        return shares;
    }

    private static Set<Integer> remainderRecipients(List<Share> shares, BigInteger cents) {
        int remaining = cents.subtract(shares.stream().map(Share::cents).reduce(BigInteger.ZERO, BigInteger::add)).intValueExact();
        var ranked = shares.stream().sorted(Comparator.comparing(Share::remainder).reversed()
                .thenComparingInt(Share::order)).toList();
        Set<Integer> extra = new HashSet<>();
        for (int index = 0; index < remaining; index++) extra.add(ranked.get(index).order());
        return extra;
    }

    private static boolean sameLine(InvoiceLineItem left, InvoiceLineItem right) {
        return left == right || right != null && left.getId() != null && left.getId().equals(right.getId());
    }
    private static BigInteger minor(BigDecimal value) {
        return InvoiceAmounts.money(value).movePointRight(2).toBigIntegerExact();
    }
}
