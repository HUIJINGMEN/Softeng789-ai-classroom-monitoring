const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runtimeImports, resolveLocal } = require('./helpers/sourceGraph.cjs');
const root = path.join(__dirname, '../src');

test('payment views depend on state hooks, not API clients or request state', () => {
  for (const [file, hook] of [
    ['features/payments/components/BillingOperationsWorkspace.tsx', '../useBillingOperations'],
    ['features/payments/components/LessonCreditPanel.tsx', '../useLessonCreditPanel'],
    ['features/payments/components/InvoiceReviewModal.tsx', '../useInvoiceReview']
  ]) {
    const imports = runtimeImports(path.join(root, file));
    assert(imports.includes(hook), file);
    assert(!imports.some(value => /(^|\/)api(?:\/|$)|apiClient|^react$/.test(value)), file);
  }
});

test('calculation models and their runtime dependencies stay independent of React and transport', () => {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const imported of runtimeImports(file)) {
      assert(!/^react(?:\/|$)|(^|\/)api(?:\/|$)|apiClient|Api$|\/components\//.test(imported), `${file}: ${imported}`);
      if (!imported.startsWith('.')) continue;
      const resolved = resolveLocal(file, imported);
      assert(resolved, `${file}: unresolved import ${imported}`);
      visit(resolved);
    }
  }
  for (const model of ['money', 'studentPaymentModel', 'lessonCreditPanelModel', 'invoiceReviewModel']) {
    visit(path.join(root, `features/payments/${model}.ts`));
  }
});
