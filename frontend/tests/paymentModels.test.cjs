const test = require('node:test');
const assert = require('node:assert/strict');

const draft = require(process.env.PAYMENT_DRAFT_MODEL_PATH);
const admin = require(process.env.PAYMENT_ADMIN_MODEL_PATH);
const student = require(process.env.PAYMENT_STUDENT_MODEL_PATH);

test('payment draft totals charges and credits consistently', () => {
  const lines = [
    { id: 'charge', description: 'Tuition', type: 'CHARGE', amount: '4200.00' },
    { id: 'credit', description: 'Scholarship', type: 'CREDIT', amount: '500.00' }
  ];

  assert.equal(draft.calculateDraftTotal(lines), 3700);
  assert.equal(draft.isPaymentDraftValid('Semester fees', '2026-10-20', lines), true);
  assert.equal(draft.isPaymentDraftValid('  ', '2026-10-20', lines), false);
});

test('payment payload normalises user-entered values at the boundary', () => {
  const selected = new Map([['student-1', { student: { id: 'student-1' } }]]);
  const payload = draft.toCreateInvoicePayload(
    selected,
    '  Semester fees  ',
    '2026-10-20',
    '  Current period  ',
    [{ id: 'charge', description: '  Course fee  ', type: 'CHARGE', amount: '180.50' }]
  );

  assert.deepEqual(payload, {
    studentIds: ['student-1'],
    title: 'Semester fees',
    dueDate: '2026-10-20',
    note: 'Current period',
    lineItems: [{ description: 'Course fee', type: 'CHARGE', amount: 180.5 }]
  });
});

test('admin payment summary derives one consistent collection view', () => {
  const summary = admin.toAdminPaymentSummaryView({
    outstanding: 3055,
    collected: 4970,
    overdueCount: 1,
    openCount: 2,
    currency: 'NZD'
  });

  assert.equal(summary.collectionRate, 62);
  assert.equal(summary.outstandingRate, 38);
  assert.equal(summary.outstandingLabel, '$3,055.00');
  assert.equal(summary.issuedLabel, '$8,025.00');
});

test('payment page range remains correct on the final page', () => {
  const page = {
    items: [{ id: 1 }, { id: 2 }],
    page: 2,
    size: 10,
    totalItems: 22,
    totalPages: 3,
    hasPrevious: true,
    hasNext: false
  };

  assert.equal(admin.paymentPageRangeLabel(page, false), '21–22 of 22');
});

test('student payment model keeps payable statements separate from history', () => {
  const invoices = [
    { id: 'pending', balance: 180, status: 'PENDING' },
    { id: 'part-paid', balance: 80, status: 'PARTIALLY_PAID' },
    { id: 'paid', balance: 0, status: 'PAID' },
    { id: 'cancelled', balance: 90, status: 'CANCELLED' }
  ];

  const result = student.splitStudentInvoices(invoices);

  assert.deepEqual(result.openInvoices.map((invoice) => invoice.id), ['pending', 'part-paid']);
  assert.deepEqual(result.history.map((invoice) => invoice.id), ['paid', 'cancelled']);
  assert.equal(student.statementDueDatePrefix('2026-10-20', 2), 'Earliest due');
  assert.equal(student.statementDueDatePrefix(null, 0), null);
});

test('student payment model surfaces the current receipt state', () => {
  const invoice = {
    bankTransfers: [
      { id: 'pending', status: 'PENDING' },
      { id: 'rejected', status: 'REJECTED', reviewNote: 'Reference did not match' }
    ]
  };

  assert.equal(student.pendingBankTransfer(invoice).id, 'pending');
  assert.equal(student.latestRejectedBankTransfer(invoice).id, 'rejected');
  assert.equal(student.pendingBankTransfer({ bankTransfers: [] }), null);
});
