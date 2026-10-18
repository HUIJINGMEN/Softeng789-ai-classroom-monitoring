const test = require('node:test');
const assert = require('node:assert/strict');

const draft = require(process.env.PAYMENT_DRAFT_MODEL_PATH);
const admin = require(process.env.PAYMENT_ADMIN_MODEL_PATH);
const classBilling = require(process.env.PAYMENT_CLASS_BILLING_MODEL_PATH);
const invoiceReview = require(process.env.PAYMENT_INVOICE_REVIEW_MODEL_PATH);
const student = require(process.env.PAYMENT_STUDENT_MODEL_PATH);
const reconciliation = require(process.env.PAYMENT_RECONCILIATION_MODEL_PATH);
const money = require(require('node:path').join(require('node:path').dirname(process.env.PAYMENT_DRAFT_MODEL_PATH), 'money.js'));

test('account overdue wording does not claim the full mixed-due-date balance is overdue', () => {
  const detail = admin.studentAccountDetail({state: 'OVERDUE', balance: 585, overdueBalance: 85, currency: 'NZD'});
  assert.match(detail, /85\.00 overdue/);
  assert.match(detail, /585\.00 total outstanding/);
  assert.doesNotMatch(detail, /585\.00 (?:remains )?overdue/);
  assert.match(admin.studentAccountDetail({state: 'OVERDUE', balance: 585, currency: 'NZD'}), /Overdue amount unavailable/);
});

test('batch delivery distinguishes confirmed, uncertain and rejected outcomes', () => {
  for (const status of ['SENT', 'DEMO']) {
    assert.deepEqual(invoiceReview.invoiceDeliveryOutcome({status: 'fulfilled', value: {status}}), {status, warning: ''});
  }
  for (const status of ['UNKNOWN', 'FAILED', undefined]) {
    assert.deepEqual(invoiceReview.invoiceDeliveryOutcome({status: 'fulfilled', value: {status, message: 'Check mail delivery'}}),
      {status: 'UNKNOWN', warning: 'Check mail delivery'});
  }
  assert.deepEqual(invoiceReview.invoiceDeliveryOutcome({status: 'rejected', reason: new Error('offline')}), {status: 'FAILED', warning: ''});
});

test('lesson utilization distinguishes no lesson credits from a genuinely unused package', () => {
  assert.deepEqual(admin.courseLessonUse({purchasedLessons: 0, usedLessons: 0, utilizationPercent: 0}),
    {label: '—', detail: 'No lesson credits'});
  assert.deepEqual(admin.courseLessonUse({purchasedLessons: 10, usedLessons: 0, utilizationPercent: 0}),
    {label: '0%', detail: '0/10 lessons'});
  assert.deepEqual(admin.courseLessonUse({purchasedLessons: 20, usedLessons: 4, utilizationPercent: 20}),
    {label: '20%', detail: '4/20 lessons'});
});

test('batch money totals reconcile in cents instead of accumulating floating-point residue', () => {
  assert.equal(money.sumMoneyValues([0.10, 0.20, -0.30]), 0);
  assert.equal(money.sumMoneyValues(Array(100).fill(9999999999.99)), 999999999999);
  assert.equal(money.moneyMinorUnits('9999999999.99'), 999999999999);
  assert.equal(money.moneyMinorUnits('10000000000.00'), null);
});

test('invoice draft money is exact in cents and zero net never passes validation', () => {
  const lines = [
    {description: 'A', type: 'CHARGE', amount: '0.10'},
    {description: 'B', type: 'CHARGE', amount: '0.20'},
    {description: 'Discount', type: 'CREDIT', amount: '0.30'}
  ];
  assert.equal(draft.calculateDraftTotal(lines), 0);
  assert.equal(draft.isPaymentDraftValid('Audit', '2026-10-31', lines), false);
  assert.equal(draft.isStudentInvoicePlanValid({includeInBatch: true, courses: [], lines}), false);
  const purchases = [{amount: '0.20'}];
  assert.equal(draft.calculateInvoiceDraftTotal([lines[0]], purchases), 0.30);
  for (const amount of ['0', '-1', '1.001', '99.995', 'Infinity', '1e2', '10000000000.00']) {
    assert.equal(draft.isPaymentDraftValid('Audit', '2026-10-31', [{description: 'Fee', type: 'CHARGE', amount}]), false, amount);
  }
  assert.equal(draft.isPaymentDraftValid('Audit', '2026-10-31', [{description: 'Fee', type: 'CHARGE', amount: '9999999999.99'}]), true);
});

test('individual batch plans and the shared draft calculator agree over many decimal inputs', () => {
  for (let cents = 1; cents <= 250; cents++) {
    const lines = [
      {description: 'Fee', type: 'CHARGE', amount: (cents / 100).toFixed(2)},
      {description: 'Credit', type: 'CREDIT', amount: (cents / 100).toFixed(2)}
    ];
    assert.equal(draft.calculateDraftTotal(lines), 0);
    assert.equal(draft.studentInvoicePlanTotal({courses: [], lines}), 0);
    assert.equal(draft.isPaymentDraftValid('Audit', '2026-10-31', lines), false);
  }
});

test('finds course packages without losing legacy invoices or counting a package twice', () => {
  const legacy = { id: 'legacy-package' };
  const first = { id: 'course-a' };
  const second = { id: 'course-b' };
  assert.deepEqual(invoiceReview.invoiceSessionPackages(null), []);
  assert.deepEqual(invoiceReview.invoiceSessionPackages({ coursePurchases: [], sessionPackage: legacy }), [legacy]);
  assert.deepEqual(invoiceReview.invoiceSessionPackages({ coursePurchases: [{ sessionPackage: null }], sessionPackage: legacy }), [legacy]);
  assert.deepEqual(invoiceReview.invoiceSessionPackages({ coursePurchases: [{ sessionPackage: first }, { sessionPackage: null }, { sessionPackage: second }], sessionPackage: legacy }), [first, second]);
  assert.deepEqual(invoiceReview.invoiceSessionPackages({ coursePurchases: [], sessionPackage: null }), []);
});

test('reconciliation selects the next useful week from duplicate, unsorted ISO dates', () => {
  const dates = ['2027-02-03', '2026-12-30', '2027-01-06', '2027-01-06', ''];
  assert.equal(reconciliation.nearestTeachingWeek(dates, '2026-12-29'), '2026-12-28');
  assert.equal(reconciliation.nearestTeachingWeek(dates, '2027-01-11'), '2027-02-01');
  assert.equal(reconciliation.nearestTeachingWeek(dates, '2027-03-01'), '2027-02-01');
  assert.equal(reconciliation.nearestTeachingWeek([], '2027-01-06'), '2027-01-04');
});

test('class billing summaries keep all four purchase modes and fallback values distinct', () => {
  const plan = {
    purchaseMode: 'LESSON_PACKAGE', defaultPrice: 500, currency: 'NZD',
    defaultSessionCount: 5, packageValidityDays: 28, absencePolicy: 'CONSUME_UNEXCUSED',
    membershipInterval: null, sessionsPerPeriod: null, payPerLessonTrigger: null
  };
  const schedule = { count: 1, from: '2026-10-05', to: '2026-10-05' };
  const facts = (changes = {}, dates = schedule) => classBilling.classBillingSummaryFacts({ ...plan, ...changes }, dates);

  assert.equal(facts()[0].value, '5 lessons');
  assert.equal(facts()[0].detail, 'Valid for 28 days');
  assert.equal(facts()[1].value, 'Deduct if unexcused');
  const flexiblePackage = facts({ defaultSessionCount: null, packageValidityDays: null, absencePolicy: 'ATTENDANCE_ONLY' });
  assert.equal(flexiblePackage[0].value, 'Set per invoice');
  assert.equal(flexiblePackage[0].detail, 'Uses the selected service dates.');
  assert.equal(flexiblePackage[1].value, 'Keep the lesson');

  assert.equal(facts({ purchaseMode: 'MEMBERSHIP' })[0].value, 'Monthly');
  assert.equal(facts({ purchaseMode: 'MEMBERSHIP' })[1].value, 'Unlimited');
  const membership = facts({ purchaseMode: 'MEMBERSHIP', membershipInterval: 'WEEKLY', sessionsPerPeriod: 4 });
  assert.equal(membership[0].value, 'Weekly');
  assert.equal(membership[1].value, '4 per period');

  assert.equal(facts({ purchaseMode: 'PAY_PER_LESSON' })[1].value, 'Attendance');
  assert.equal(facts({ purchaseMode: 'PAY_PER_LESSON', payPerLessonTrigger: 'BOOKING' })[1].value, 'Booking');
  assert.equal(facts({ purchaseMode: 'COURSE_ENROLMENT' })[0].value, '1 scheduled lesson');
  const emptyCourse = facts({ purchaseMode: 'COURSE_ENROLMENT' }, { count: 0, from: '', to: '' });
  assert.equal(emptyCourse[0].value, 'No lessons scheduled');
  assert.equal(emptyCourse[0].detail, 'Build the timetable to add course dates.');
  assert.equal(emptyCourse[1].value, 'Complete course');
});

test('course purchase drafts never share mutable entitlement state', () => {
  const first = draft.createCoursePurchaseDraft();
  const second = draft.createCoursePurchaseDraft();
  assert.equal(first.entitlement.enabled, true);
  assert.notEqual(first.entitlement, second.entitlement);
  first.entitlement.courseOfferingId = 'changed';
  assert.equal(second.entitlement.courseOfferingId, '');
});

test('class billing draft keeps mode-specific fields at the API boundary', () => {
  const lessonPackage = classBilling.createClassBillingDraft({
    purchaseMode: 'LESSON_PACKAGE',
    defaultPrice: 500,
    currency: 'NZD',
    defaultSessionCount: 10,
    packageValidityDays: 90,
    absencePolicy: 'CONSUME_UNEXCUSED',
    membershipInterval: null,
    sessionsPerPeriod: null,
    payPerLessonTrigger: null
  });

  assert.equal(classBilling.isClassBillingDraftValid(lessonPackage), true);
  assert.deepEqual(classBilling.toClassBillingPlanUpdate(lessonPackage), {
    purchaseMode: 'LESSON_PACKAGE',
    defaultPrice: 500,
    defaultSessionCount: 10,
    packageValidityDays: 90,
    absencePolicy: 'CONSUME_UNEXCUSED',
    membershipInterval: null,
    sessionsPerPeriod: null,
    payPerLessonTrigger: null
  });

  const membership = {
    ...lessonPackage,
    mode: 'MEMBERSHIP',
    membershipInterval: 'MONTHLY',
    sessionsPerPeriod: '4'
  };
  assert.deepEqual(classBilling.toClassBillingPlanUpdate(membership), {
    purchaseMode: 'MEMBERSHIP',
    defaultPrice: 500,
    defaultSessionCount: null,
    packageValidityDays: null,
    absencePolicy: null,
    membershipInterval: 'MONTHLY',
    sessionsPerPeriod: 4,
    payPerLessonTrigger: null
  });
});

test('class billing validation rejects invalid package and membership limits', () => {
  const base = {
    mode: 'LESSON_PACKAGE',
    price: '500',
    sessionCount: '10',
    validityDays: '90',
    absencePolicy: 'CONSUME_UNEXCUSED',
    membershipInterval: 'MONTHLY',
    sessionsPerPeriod: '',
    payTrigger: 'ATTENDANCE'
  };

  assert.equal(classBilling.isClassBillingDraftValid(base), true);
  assert.equal(classBilling.isClassBillingDraftValid({ ...base, sessionCount: '0' }), false);
  assert.equal(classBilling.isClassBillingDraftValid({ ...base, validityDays: '3651' }), false);
  assert.equal(classBilling.isClassBillingDraftValid({
    ...base,
    mode: 'MEMBERSHIP',
    sessionsPerPeriod: '501'
  }), false);
});

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

test('payment payload includes a validated lesson-package entitlement', () => {
  const selected = new Map([['student-1', { student: { id: 'student-1' } }]]);
  const entitlement = {
    enabled: true,
    courseOfferingId: 'offering-1',
    purchaseMode: 'LESSON_PACKAGE',
    includedSessions: '10',
    validFrom: '2026-10-01',
    validTo: '2026-12-01',
    absencePolicy: 'CONSUME_UNEXCUSED',
    classroomSessionId: ''
  };

  assert.equal(draft.isLearningEntitlementValid(entitlement), true);
  assert.equal(draft.isLearningEntitlementValid({ ...entitlement, validTo: '2026-09-01' }), false);

  const payload = draft.toCreateInvoicePayload(
    selected,
    'Ten-session package',
    '2026-10-20',
    '',
    [{ id: 'charge', description: 'Course sessions', type: 'CHARGE', amount: '500' }],
    entitlement
  );

  assert.deepEqual(payload.entitlement, {
    courseOfferingId: 'offering-1',
    purchaseMode: 'LESSON_PACKAGE',
    includedSessions: 10,
    validFrom: '2026-10-01',
    validTo: '2026-12-01',
    absencePolicy: 'CONSUME_UNEXCUSED'
  });
});

test('learning entitlement validation follows each class purchase mode', () => {
  const base = {
    enabled: true,
    courseOfferingId: 'offering-1',
    purchaseMode: 'COURSE_ENROLMENT',
    includedSessions: '',
    validFrom: '',
    validTo: '',
    absencePolicy: 'CONSUME_UNEXCUSED',
    classroomSessionId: ''
  };

  assert.equal(draft.isLearningEntitlementValid(base), true);
  assert.equal(draft.isLearningEntitlementValid({
    ...base,
    purchaseMode: 'MEMBERSHIP',
    validFrom: '2026-10-01',
    validTo: '2026-10-31'
  }), true);
  assert.equal(draft.isLearningEntitlementValid({ ...base, purchaseMode: 'MEMBERSHIP' }), false);
  assert.equal(draft.isLearningEntitlementValid({
    ...base,
    purchaseMode: 'PAY_PER_LESSON',
    classroomSessionId: 'session-1'
  }), true);
  assert.equal(draft.isLearningEntitlementValid({ ...base, purchaseMode: 'PAY_PER_LESSON' }), false);
});

test('one invoice payload keeps multiple course purchases separate from additional fees', () => {
  const selected = new Map([['student-1', { student: { id: 'student-1' } }]]);
  const baseEntitlement = {
    enabled: true,
    purchaseMode: 'LESSON_PACKAGE',
    includedSessions: '10',
    validFrom: '2026-11-01',
    validTo: '2027-01-31',
    absencePolicy: 'CONSUME_UNEXCUSED',
    classroomSessionId: ''
  };
  const purchases = [
    { id: 'hip-hop', description: ' Hip Hop · 10 lessons ', amount: '300', entitlement: { ...baseEntitlement, courseOfferingId: 'course-1' } },
    { id: 'ballet', description: 'Ballet full course', amount: '500', entitlement: { ...baseEntitlement, courseOfferingId: 'course-2', purchaseMode: 'COURSE_ENROLMENT', includedSessions: '', validFrom: '', validTo: '' } }
  ];

  assert.equal(draft.isPaymentDraftValid(
    'Summer programme',
    '2026-10-30',
    [{ id: 'fee', description: 'Registration fee', type: 'CHARGE', amount: '30' }],
    purchases
  ), true);

  const payload = draft.toCreateInvoicePayload(
    selected,
    'Summer programme',
    '2026-10-30',
    '',
    [{ id: 'fee', description: 'Registration fee', type: 'CHARGE', amount: '30' }],
    purchases
  );

  assert.equal(payload.coursePurchases.length, 2);
  assert.deepEqual(payload.coursePurchases[0], {
    description: 'Hip Hop · 10 lessons',
    amount: 300,
    entitlement: {
      courseOfferingId: 'course-1',
      purchaseMode: 'LESSON_PACKAGE',
      validFrom: '2026-11-01',
      validTo: '2027-01-31',
      includedSessions: 10,
      absencePolicy: 'CONSUME_UNEXCUSED'
    }
  });
  assert.deepEqual(payload.lineItems, [{ description: 'Registration fee', type: 'CHARGE', amount: 30 }]);
});

test('student-led billing keeps each student course list independent', () => {
  const preview = {
    billingDate: '2026-10-09',
    students: [
      {
        studentId: 'student-1', studentName: 'Ana Ngata', studentNumber: 'DEMO-2601',
        courses: [
          {
            courseOfferingId: 'course-1', courseCode: 'COMPSCI 335', academicTerm: '2026',
            purchaseMode: 'COURSE_ENROLMENT', description: 'COMPSCI 335 full course enrolment',
            defaultPrice: 600, currency: 'NZD', status: 'READY', statusDetail: 'Not yet invoiced',
            selectedByDefault: true, preferredCourse: true, validFrom: null, validTo: null,
            includedSessions: null, absencePolicy: null, availableSessions: [], classroomSessionId: null,
            classroomSessionDate: null, classroomSessionStartTime: null, classroomSessionEndTime: null,
            previousInvoiceNumber: null
          },
          {
            courseOfferingId: 'course-2', courseCode: 'COMPSCI 726', academicTerm: '2026',
            purchaseMode: 'COURSE_ENROLMENT', description: 'COMPSCI 726 full course enrolment',
            defaultPrice: 750, currency: 'NZD', status: 'READY', statusDetail: 'Not yet invoiced',
            selectedByDefault: true, preferredCourse: false, validFrom: null, validTo: null,
            includedSessions: null, absencePolicy: null, availableSessions: [], classroomSessionId: null,
            classroomSessionDate: null, classroomSessionStartTime: null, classroomSessionEndTime: null,
            previousInvoiceNumber: null
          }
        ]
      },
      {
        studentId: 'student-2', studentName: 'Ethan Smith', studentNumber: 'DEMO-2602',
        courses: []
      }
    ]
  };

  const plans = draft.studentPlansFromPreview(preview);
  assert.equal(plans[0].includeInBatch, true);
  assert.equal(plans[1].includeInBatch, false);
  assert.equal(draft.studentInvoicePlanTotal(plans[0]), 1350);
  assert.equal(draft.isStudentInvoiceBatchValid(plans), true);

  const payload = draft.toStudentInvoiceBatchPayload(plans, '2026 course fees', '2026-10-30', 'Please review');
  assert.equal(payload.invoices.length, 1);
  assert.equal(payload.invoices[0].studentId, 'student-1');
  assert.equal(payload.invoices[0].coursePurchases.length, 2);
  assert.deepEqual(payload.invoices[0].coursePurchases.map((item) => item.entitlement.courseOfferingId), ['course-1', 'course-2']);
});

test('a missing course price blocks only that included student invoice', () => {
  const plans = draft.studentPlansFromPreview({
    billingDate: '2026-10-09',
    students: [{
      studentId: 'student-1', studentName: 'Ana Ngata', studentNumber: 'DEMO-2601',
      courses: [{
        courseOfferingId: 'course-1', courseCode: 'DANCE 101', academicTerm: 'Summer',
        purchaseMode: 'LESSON_PACKAGE', description: 'DANCE 101 lesson package', defaultPrice: null,
        currency: 'NZD', status: 'NEEDS_PRICE', statusDetail: 'Add a price', selectedByDefault: true,
        preferredCourse: false, validFrom: '2026-10-09', validTo: '2027-01-06', includedSessions: 10,
        absencePolicy: 'CONSUME_UNEXCUSED', availableSessions: [], classroomSessionId: null,
        classroomSessionDate: null, classroomSessionStartTime: null, classroomSessionEndTime: null,
        previousInvoiceNumber: null
      }]
    }]
  });

  assert.equal(draft.isStudentInvoiceBatchValid(plans), false);
  plans[0].courses[0].amount = '300';
  assert.equal(draft.isStudentInvoiceBatchValid(plans), true);
});

test('admin payment summary derives one consistent collection view', () => {
  const summary = admin.toAdminPaymentSummaryView({
    outstanding: 3055,
    collected: 4970,
    issued: 8025,
    collectionRate: 62,
    draftCount: 3,
    overdueCount: 1,
    openCount: 2,
    currency: 'NZD'
  });

  assert.equal(summary.collectionRate, 62);
  assert.equal(summary.outstandingRate, 38);
  assert.equal(summary.outstandingLabel, '$3,055.00');
  assert.equal(summary.issuedLabel, '$8,025.00');
  assert.equal(summary.draftCount, 3);
});

test('surplus receipts cannot inflate issued charges or settle a different invoice in collection progress', () => {
  const summary = admin.toAdminPaymentSummaryView({issued: 150, collected: 100, outstanding: 100, collectionRate: 33,
    draftCount: 0, overdueCount: 1, openCount: 1, currency: 'NZD'});
  assert.equal(summary.issuedLabel, '$150.00');
  assert.equal(summary.collectionRate, 33);
  assert.equal(summary.overdueInvoiceCount, 1);
  const fullyPaid = admin.toAdminPaymentSummaryView({issued: 50, collected: 100, outstanding: 0, collectionRate: 100,
    draftCount: 0, overdueCount: 0, openCount: 0, currency: 'NZD'});
  assert.equal(fullyPaid.issuedLabel, '$50.00');
  assert.equal(fullyPaid.collectionRate, 100);
});

test('student account state copy keeps reported payments separate from paid balances', () => {
  const row = {
    state: 'PAYMENT_REVIEW',
    paymentReported: 120,
    balance: 120,
    received: 0,
    draftCount: 0,
    unbilledCourseCount: 0,
    currency: 'NZD'
  };

  assert.equal(admin.STUDENT_ACCOUNT_STATE_LABELS.PAYMENT_REVIEW, 'Payment reported');
  assert.equal(admin.studentAccountAction(row), 'Review payment');
  assert.match(admin.studentAccountDetail(row), /verify before the balance changes/);
});

test('student account actions route billing work without relabelling it as unpaid', () => {
  assert.equal(admin.studentAccountAction({ state: 'NEEDS_INVOICE', primaryInvoiceId: null }), 'Prepare invoice');
  assert.equal(admin.studentAccountAction({ state: 'DRAFT', primaryInvoiceId: 'invoice-1' }), 'Review draft');
  assert.equal(admin.studentAccountAction({ state: 'PAID', primaryInvoiceId: 'invoice-2' }), 'Open account');
  assert.equal(admin.studentAccountAction({ state: 'NO_PAYMENT_DUE', primaryInvoiceId: null }), '');
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

test('invoice review prepares AI text until a student-facing message was reviewed or sent', () => {
  assert.equal(invoiceReview.shouldPrepareAiMessage({
    status: 'OVERDUE',
    messageReviewedAt: null,
    lastEmailedAt: null
  }), true);
  assert.equal(invoiceReview.shouldPrepareAiMessage({
    status: 'DRAFT',
    messageDraftSavedAt: '2026-10-08T01:00:00Z',
    messageReviewedAt: null,
    lastEmailedAt: null
  }), false);
  assert.equal(invoiceReview.shouldPrepareAiMessage({
    status: 'DRAFT',
    messageReviewedAt: '2026-10-08T02:00:00Z',
    lastEmailedAt: null
  }), false);
  assert.equal(invoiceReview.shouldPrepareAiMessage({
    status: 'PENDING',
    messageReviewedAt: null,
    lastEmailedAt: '2026-10-08T02:00:00Z'
  }), false);
  assert.equal(invoiceReview.shouldPrepareAiMessage({
    status: 'PAID',
    messageReviewedAt: null,
    lastEmailedAt: null
  }), false);
});

test('invoice review describes membership limits and a selected lesson accurately', () => {
  const base = {
    purchaseMode: 'MEMBERSHIP',
    includedSessions: '',
    validFrom: '2026-10-01',
    validTo: '2026-10-31'
  };
  assert.equal(invoiceReview.draftPurchaseSummary(base, { sessionsPerPeriod: 4 }).value, '4 lessons per period');
  assert.equal(invoiceReview.draftPurchaseSummary({ ...base, purchaseMode: 'PAY_PER_LESSON' }, undefined, '12 Oct · 4:00 pm – 5:00 pm').value, '12 Oct · 4:00 pm – 5:00 pm');
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
    manualPayments: [
      { id: 'pending', status: 'PENDING' },
      { id: 'rejected', status: 'REJECTED', reviewNote: 'Reference did not match' }
    ]
  };

  assert.equal(student.pendingManualPayment(invoice).id, 'pending');
  assert.equal(student.latestRejectedManualPayment(invoice).id, 'rejected');
  assert.equal(student.pendingManualPayment({ manualPayments: [] }), null);
});

test('lesson reconciliation keeps ISO weeks stable across month boundaries', () => {
  assert.equal(reconciliation.startOfIsoWeek('2026-10-08'), '2026-10-05');
  assert.equal(reconciliation.endOfIsoWeek('2026-10-05'), '2026-10-11');
  assert.equal(reconciliation.shiftIsoWeek('2026-10-05', 1), '2026-10-12');
  assert.equal(reconciliation.shiftIsoWeek('2026-10-05', -1), '2026-09-28');
});

test('lesson reconciliation opens the nearest week that actually has a class', () => {
  assert.equal(
    reconciliation.nearestTeachingWeek(['2026-08-14', '2026-09-05'], '2026-10-09'),
    '2026-08-31'
  );
  assert.equal(
    reconciliation.nearestTeachingWeek(['2026-10-08', '2026-10-22'], '2026-10-09'),
    '2026-10-05'
  );
  assert.equal(
    reconciliation.nearestTeachingWeek(['2026-10-22', '2026-11-05'], '2026-10-09'),
    '2026-10-19'
  );
  assert.equal(reconciliation.nearestTeachingWeek([], '2026-10-09'), '2026-10-05');
});

test('lesson reconciliation presents attendance and credit as separate facts', () => {
  const session = {
    id: 'session-1',
    date: '2026-10-07',
    startTime: '2026-10-07T09:00:00Z',
    endTime: '2026-10-07T10:00:00Z',
    status: 'COMPLETED'
  };
  const cell = {
    sessionId: 'session-1',
    attendanceStatus: 'ABSENT',
    creditStatus: 'MAKEUP_SCHEDULED',
    makeupSessionDate: '2026-10-13'
  };

  assert.deepEqual(reconciliation.lessonCellView(session, cell), {
    attendance: 'Absent',
    symbol: '×',
    outcome: 'Make-up 13 Oct',
    outcomeTone: 'makeup',
    tone: 'absent',
    attention: false
  });
});

test('lesson reconciliation shows an explained absence without an individual lesson credit', () => {
  const session = {
    id: 'session-full-course',
    date: '2026-10-09',
    startTime: '2026-10-09T09:00:00Z',
    endTime: '2026-10-09T10:00:00Z',
    status: 'COMPLETED'
  };
  const cell = {
    sessionId: 'session-full-course',
    attendanceStatus: 'ABSENT',
    absenceReason: 'ADVANCE_NOTICE',
    creditStatus: 'USED',
    makeupSessionDate: null
  };

  assert.deepEqual(reconciliation.lessonCellView(session, cell), {
    attendance: 'Approved leave',
    symbol: 'L',
    outcome: 'Used',
    outcomeTone: 'used',
    tone: 'leave',
    attention: false
  });
});

test('lesson reconciliation shows approved leave before a scheduled lesson starts', () => {
  const session = {
    id: 'future-session',
    date: '2026-10-14',
    startTime: '2026-10-14T01:00:00Z',
    endTime: '2026-10-14T04:00:00Z',
    status: 'SCHEDULED'
  };
  const cell = {
    sessionId: 'future-session',
    attendanceStatus: 'ABSENT',
    absenceReason: 'ILLNESS',
    creditStatus: null,
    uncoveredAttendance: true,
    makeupSessionDate: null
  };

  assert.deepEqual(reconciliation.lessonCellView(session, cell), {
    attendance: 'Sick',
    symbol: 'S',
    outcome: 'Not covered',
    outcomeTone: 'uncovered',
    tone: 'sick',
    attention: true
  });
});
