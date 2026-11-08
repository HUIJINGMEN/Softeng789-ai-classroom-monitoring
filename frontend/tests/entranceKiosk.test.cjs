const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const src = path.join(__dirname, '../src');

/** Bundles an in-memory entry so ApiError and the models share one class identity inside the VM. */
function load(contents, globals = {}) {
  const code = buildSync({
    stdin: { contents, resolveDir: src, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react', 'react/jsx-runtime'], define: { 'import.meta.env': '{}' }
  }).outputFiles[0].text;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require, ...globals });
  vm.runInContext(code, context);
  return { exports: module.exports, context };
}

const { exports: kiosk, context } = load(`
  export * from './features/entrance-kiosk/presenceGate';
  export * from './features/entrance-kiosk/kioskFlowModel';
  export * from './features/entrance-kiosk/launchModel';
  export { ApiError } from './lib/apiClient';
`);
const review = load(`export * from './features/kiosk-review/reviewModel';`).exports;
/** Values created inside the VM have that realm's prototypes; compare their JSON shape instead. */
const plain = value => JSON.parse(JSON.stringify(value));
const apiError = (status, code, extra = {}) => new kiosk.ApiError('detail', status, { code, ...extra });
const vmTypeError = () => vm.runInContext('new TypeError("Failed to fetch")', context);

const face = (width = 0.3) => ({ count: 1, boxes: [{ x: 0.3, y: 0.2, width, height: width }] });
const nobody = { count: 0, boxes: [] };

test('presence gate captures once after two seconds of one close face', () => {
  const gate = new kiosk.PresenceGate();
  for (let at = 0; at < 2000; at += 200) {
    const update = gate.update(face(), at);
    assert.equal(update.trigger, false);
    assert.equal(update.status, 'HOLDING');
  }
  const fired = gate.update(face(), 2000);
  assert.equal(fired.trigger, true);
  assert.equal(gate.update(face(), 2200).status, 'LOCKED');
  assert.equal(gate.update(face(), 5000).trigger, false);
});

test('presence gate restarts the dwell for no face, a far face, several faces, gaps and clock jumps', () => {
  for (const interrupt of [nobody, face(0.05), { count: 2, boxes: [face().boxes[0], face().boxes[0]] }]) {
    const gate = new kiosk.PresenceGate();
    for (let at = 0; at <= 1800; at += 200) gate.update(face(), at);
    gate.update(interrupt, 1900);
    for (let at = 2100; at < 4100; at += 200) assert.equal(gate.update(face(), at).trigger, false);
    assert.equal(gate.update(face(), 4100).trigger, true);
  }
  const gap = new kiosk.PresenceGate();
  gap.update(face(), 0); gap.update(face(), 1000);
  assert.equal(gap.update(face(), 2500).trigger, false, 'a 1.5 s frame gap must not complete a dwell');
  const backwards = new kiosk.PresenceGate();
  backwards.update(face(), 5000);
  assert.equal(backwards.update(face(), 1000).trigger, false);
  assert.equal(backwards.update(face(), NaN).trigger, false);
});

test('after a result the gate waits for the person to leave, or a timeout, before capturing again', () => {
  const gate = new kiosk.PresenceGate();
  for (let at = 0; at <= 2000; at += 200) gate.update(face(), at);
  gate.release(3000);
  for (let at = 3000; at < 9000; at += 200) assert.notEqual(gate.update(face(), at).trigger, true);
  // Still the same face after 6 s: re-armed by timeout, then a full new dwell is needed.
  let fired = false;
  for (let at = 9000; at <= 11400 && !fired; at += 200) fired = gate.update(face(), at).trigger;
  assert(fired);

  const leaving = new kiosk.PresenceGate();
  for (let at = 0; at <= 2000; at += 200) leaving.update(face(), at);
  leaving.release(3000);
  for (let at = 3000; at <= 4000; at += 200) leaving.update(nobody, at);
  assert.equal(leaving.update(face(), 4200).status, 'HOLDING');
  const fresh = new kiosk.PresenceGate();
  fresh.update(face(), 0); fresh.reset();
  assert.equal(fresh.update(face(), 100).status, 'HOLDING');
});

const candidates = [
  { candidateId: 'c2', rank: 2, displayName: 'Ana B.', photo: null },
  { candidateId: 'c1', rank: 1, displayName: 'Minji K.', photo: null }
];
const captured = (overrides = {}) => ({
  attemptId: 'a1', outcome: 'CANDIDATES', state: 'AWAITING_SELECTION', qualityReasons: [],
  candidates, capturedAt: '2026-11-05T20:00:00Z', expiresAt: '2026-11-05T20:02:00Z', ...overrides
});
function run(actions, start = kiosk.INITIAL_KIOSK_FLOW) {
  return actions.reduce((state, action) => kiosk.kioskFlowReducer(state, action), start);
}
function choosing() {
  return run([{ type: 'CAPTURE_STARTED' }, { type: 'CAPTURE_RESULT', result: captured(), now: 1000 }]);
}
function assertCleared(state) {
  assert.equal(state.attemptId, null);
  assert.deepEqual(plain(state.candidates), []);
  assert.equal(state.selectedId, null);
  assert.equal(state.selectionDeadline, null);
}

test('candidates are shown in rank order without a preselected name, and only listed ids can be chosen', () => {
  const state = choosing();
  assert.equal(state.view, 'choosing');
  assert.deepEqual(plain(state.candidates.map(c => c.candidateId)), ['c1', 'c2']);
  assert.equal(state.selectedId, null);
  assert.equal(state.selectionDeadline, 1000 + kiosk.SELECTION_TIMEOUT_MS);
  assert.equal(kiosk.kioskFlowReducer(state, { type: 'CONFIRM_STARTED' }).view, 'choosing', 'confirm needs a choice');
  assert.equal(kiosk.kioskFlowReducer(state, { type: 'SELECT', candidateId: 'c9' }).selectedId, null);
  const picked = kiosk.kioskFlowReducer(state, { type: 'SELECT', candidateId: 'c2' });
  assert.equal(kiosk.kioskFlowReducer(picked, { type: 'CONFIRM_STARTED' }).view, 'confirming');
});

test('a confirmed check-in shows the result, then clears every trace of that student', () => {
  const confirming = run([{ type: 'SELECT', candidateId: 'c1' }, { type: 'CONFIRM_STARTED' }], choosing());
  const result = { attemptId: 'a1', result: 'CONFIRMED', attendanceStatus: 'LATE', displayName: 'Minji K.',
    processedAt: '2026-11-05T20:00:30Z', replayed: false };
  const shown = kiosk.kioskFlowReducer(confirming, { type: 'CONFIRM_RESULT', result, now: 2000 });
  assert.equal(shown.view, 'notice');
  assert.equal(shown.notice.tone, 'success');
  assert.equal(shown.notice.displayName, 'Minji K.');
  assert.equal(shown.notice.statusLabel, 'Late');
  assert.equal(shown.notice.timeLabel, '09:00');
  assertCleared(shown);
  assert.equal(kiosk.kioskFlowReducer(shown, { type: 'NOTICE_EXPIRED', now: 2000 + 3999 }).view, 'notice');
  const next = kiosk.kioskFlowReducer(shown, { type: 'NOTICE_EXPIRED', now: 2000 + 4000 });
  assert.equal(next.view, 'scanning');
  assert.equal(next.notice, null);
  assertCleared(next);
  const stale = kiosk.kioskFlowReducer(confirming, { type: 'CONFIRM_RESULT', result: { ...result, attemptId: 'other' }, now: 1 });
  assert.equal(stale.view, 'confirming', 'a response for another attempt is ignored');
});

test('every way out of candidate selection clears names and maps to honest guidance', () => {
  const picked = run([{ type: 'SELECT', candidateId: 'c2' }, { type: 'CONFIRM_STARTED' }], choosing());
  const cases = [
    [apiError(403, 'NOT_ENROLLED'), 'notice', 'help'],
    [apiError(409, 'ATTENDANCE_LOCKED'), 'notice', 'help'],
    [apiError(410, 'ATTEMPT_EXPIRED'), 'notice', 'retry'],
    [apiError(409, 'CANDIDATES_STALE'), 'notice', 'retry'],
    [apiError(409, 'ATTEMPT_FINALIZED'), 'notice', 'retry'],
    [apiError(404, 'NOT_FOUND'), 'notice', 'retry'],
    [apiError(409, 'KIOSK_SESSION_CLOSED'), 'closed', null],
    [vmTypeError(), 'notice', 'help']
  ];
  for (const [error, view, tone] of cases) {
    const state = kiosk.kioskFlowReducer(picked, { type: 'CONFIRM_FAILED', error, now: 5 });
    assert.equal(state.view, view, error.code ?? error.message);
    if (tone) assert.equal(state.notice.tone, tone, error.code ?? error.message);
    assertCleared(state);
  }
  const uncertain = kiosk.kioskFlowReducer(picked, { type: 'CONFIRM_FAILED', error: vmTypeError(), now: 5 });
  assert.match(uncertain.notice.title, /couldn’t confirm/, 'a lost response is not reported as success or failure');
  for (const reason of ['NOT_LISTED', 'TIMEOUT']) {
    const state = kiosk.kioskFlowReducer(choosing(), { type: 'CANCELLED', reason, now: 5 });
    assert.equal(state.view, 'notice');
    assertCleared(state);
  }
  assertCleared(kiosk.kioskFlowReducer(choosing(), { type: 'WINDOW', state: 'CLOSED' }));
  assertCleared(kiosk.kioskFlowReducer(choosing(), { type: 'RESET' }));
});

test('capture outcomes guide a retake, and two misses in a row send the student to the teacher', () => {
  const capture = (result, start = kiosk.INITIAL_KIOSK_FLOW) =>
    run([{ type: 'CAPTURE_STARTED' }, { type: 'CAPTURE_RESULT', result, now: 0 }], start);
  const miss = captured({ outcome: 'NO_CANDIDATE', state: 'NO_CANDIDATE', candidates: [] });
  const first = capture(miss);
  assert.equal(first.notice.tone, 'retry');
  assert.equal(first.noCandidateStreak, 1);
  const back = kiosk.kioskFlowReducer(first, { type: 'NOTICE_EXPIRED', now: first.noticeUntil });
  const second = capture(miss, back);
  assert.equal(second.notice.tone, 'help');
  assert.equal(second.noCandidateStreak, 0);
  assert.equal(capture(captured({ outcome: 'MULTIPLE_FACES', state: 'MULTIPLE_FACES', candidates: [] })).notice.title,
    'One person at a time');
  const blurry = capture(captured({ outcome: 'LOW_QUALITY', state: 'LOW_QUALITY', candidates: [], qualityReasons: ['BLUR'] }));
  assert.equal(blurry.notice.message, 'Hold still for a moment.');
  const replay = capture(captured({ state: 'CONFIRMED', candidates: [] }));
  assert.equal(replay.view, 'notice', 'a replayed capture whose attempt already finished never reopens candidates');
});

test('capture errors map to waiting, closed, busy and unavailable states', () => {
  const failed = error => run([{ type: 'CAPTURE_STARTED' }, { type: 'CAPTURE_FAILED', error, now: 0 }]);
  assert.equal(failed(apiError(409, 'KIOSK_WINDOW_NOT_OPEN')).view, 'waiting');
  assert.equal(failed(apiError(409, 'KIOSK_SESSION_CLOSED')).view, 'closed');
  assert.equal(failed(apiError(409, 'NO_FACE_READY_STUDENTS')).notice.tone, 'help');
  assert.equal(failed(apiError(503, 'RECOGNITION_UNAVAILABLE')).notice.tone, 'help');
  assert.equal(failed(apiError(429, 'RECOGNIZER_BUSY')).notice.tone, 'retry');
  assert.equal(failed(apiError(500)).notice.tone, 'retry');
  assert.equal(kiosk.isTransient(apiError(429, 'CAPTURE_RATE_LIMITED')), true);
  assert.equal(kiosk.isTransient(vmTypeError()), true);
  assert.equal(kiosk.isTransient(apiError(409, 'ATTEMPT_FINALIZED')), false);
  assert.equal(kiosk.retryDelayMs(apiError(429, 'RECOGNIZER_BUSY', { retryAfterSeconds: 2 }), 0), 2000);
  assert.equal(kiosk.retryDelayMs(vmTypeError(), 1), 2000);
});

test('capture errors for a finished or expired attempt ask for a new scan without claiming attendance', () => {
  const failed = (error, start = kiosk.INITIAL_KIOSK_FLOW) =>
    run([{ type: 'CAPTURE_STARTED' }, { type: 'CAPTURE_FAILED', error, now: 0 }], start);
  const generic = failed(apiError(500));
  const finalized = failed(apiError(409, 'ATTEMPT_FINALIZED'));
  const expired = failed(apiError(410, 'ATTEMPT_EXPIRED'));
  const claimsOutcome = /recorded|checked in/i;

  for (const [label, state] of [['finalized', finalized], ['expired', expired]]) {
    assert.equal(state.view, 'notice', label);
    assert.equal(state.notice.tone, 'retry', label);
    assert.notEqual(state.notice.title, generic.notice.title, `${label} is not the generic error`);
    assert.doesNotMatch(`${state.notice.title} ${state.notice.message}`, claimsOutcome,
      `${label} must not say attendance was or was not recorded`);
    assertCleared(state);
    assert.equal(kiosk.kioskFlowReducer(state, { type: 'NOTICE_EXPIRED', now: state.noticeUntil }).view, 'scanning', label);
  }
  assert.equal(finalized.notice.title, 'Please scan again');
  assert.match(finalized.notice.message, /scan has already finished/);
  assert.match(expired.notice.title, /timed out/);
  assert.notEqual(expired.notice.title, finalized.notice.title, 'expiry is told apart from a finished scan');
  assert.equal(kiosk.isTransient(apiError(410, 'ATTEMPT_EXPIRED')), false, 'an expired scan is never resent');

  // A miss streak survives either notice, so the next miss still escalates to the teacher.
  const miss = captured({ outcome: 'NO_CANDIDATE', state: 'NO_CANDIDATE', candidates: [] });
  const afterMiss = run([{ type: 'CAPTURE_STARTED' }, { type: 'CAPTURE_RESULT', result: miss, now: 0 }]);
  const back = kiosk.kioskFlowReducer(afterMiss, { type: 'NOTICE_EXPIRED', now: afterMiss.noticeUntil });
  assert.equal(failed(apiError(409, 'ATTEMPT_FINALIZED'), back).noCandidateStreak, 1);
});

test('window state uses server time; initials ignore separators', () => {
  const offset = kiosk.clockOffsetMs('2026-11-05T20:00:10Z', Date.parse('2026-11-05T20:00:00Z'));
  assert.equal(offset, 10_000);
  const opens = '2026-11-05T19:45:00Z', closes = '2026-11-05T21:00:00Z';
  assert.equal(kiosk.windowStateAt(opens, closes, Date.parse('2026-11-05T19:44:59Z')), 'WAITING');
  assert.equal(kiosk.windowStateAt(opens, closes, Date.parse('2026-11-05T19:45:00Z')), 'OPEN');
  assert.equal(kiosk.windowStateAt(opens, closes, Date.parse(closes)), 'CLOSED');
  assert.equal(kiosk.windowStateAt('bad', closes, 0), 'CLOSED');
  assert.equal(kiosk.candidateInitials('Minji K.'), 'MK');
  assert.equal(kiosk.candidateInitials('Minji Kim ·123'), 'MK');
  assert.equal(kiosk.candidateInitials(''), '?');
});

const session = (overrides = {}) => ({
  sessionId: 's1', offeringId: 'o1', classLabel: 'ENG101 · English', course: 'English', campusId: 'cam1',
  roomName: 'Room 1', startTime: '2026-11-05T20:00:00Z', endTime: '2026-11-05T21:00:00Z', status: 'SCHEDULED',
  launchable: true, blockedReason: null, rosterSize: 18, faceReadyCount: 12, ...overrides
});

test('launch options group sessions by class and keep blocked sessions visible but unusable', () => {
  const sessions = [
    session({ sessionId: 's2', startTime: '2026-11-05T23:00:00Z', launchable: false, blockedReason: 'TOO_EARLY' }),
    session(),
    session({ sessionId: 's3', offeringId: 'o2', classLabel: 'ART201 · Art' })
  ];
  const classes = kiosk.classOptions(sessions);
  assert.deepEqual(plain(classes.map(c => [c.offeringId, c.sessionCount, c.launchableCount])), [['o2', 1, 1], ['o1', 2, 1]]);
  assert.deepEqual(plain(kiosk.sessionsForClass(sessions, 'o1').map(s => s.sessionId)), ['s1', 's2']);
  assert.match(kiosk.sessionOptionLabel(sessions[0]), /Opens 2 hours before class/);
  const unassigned = [session({ sessionId: 'u1', offeringId: null, launchable: false, blockedReason: 'NO_CLASS' }),
    session({ sessionId: 'u2', offeringId: null, launchable: false, blockedReason: 'NO_CLASS' })];
  const keys = plain(kiosk.classOptions(unassigned).map(c => c.offeringId));
  assert.deepEqual(keys, ['session:u1', 'session:u2'], 'sessions without a class never share one option');
  assert.deepEqual(plain(kiosk.sessionsForClass(unassigned, 'session:u2').map(s => s.sessionId)), ['u2']);
});

test('launch request validation mirrors the server contract', () => {
  const form = (overrides = {}) => ({ campusId: 'cam1', session: session(), location: '  Main   entrance ',
    lateEnabled: true, lateMinutes: '10', deviceConfirmed: true, ...overrides });
  const ok = kiosk.buildLaunchRequest(form());
  assert.equal(ok.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ok.request)), { sessionId: 's1', campusId: 'cam1',
    locationLabel: 'Main entrance', lateAfterMinutes: 10, deviceConfirmed: true });
  assert.equal(kiosk.buildLaunchRequest(form({ lateEnabled: false, lateMinutes: 'x' })).request.lateAfterMinutes, null);
  for (const [overrides, message] of [
    [{ campusId: '' }, /campus/],
    [{ session: null }, /session/],
    [{ session: session({ launchable: false, blockedReason: 'WINDOW_CLOSED' }) }, /ended/],
    [{ campusId: 'cam2' }, /different campus/],
    [{ location: ' x ' }, /location|Enter where/],
    [{ location: 'a'.repeat(81) }, /80/],
    [{ location: 'Main\u0007door' }, /letters/],
    [{ lateMinutes: '61' }, /0 to 60/],
    [{ lateMinutes: '2.5' }, /0 to 60/],
    [{ deviceConfirmed: false }, /become the kiosk/]
  ]) {
    const draft = kiosk.buildLaunchRequest(form(overrides));
    assert.equal(draft.ok, false, JSON.stringify(overrides));
    assert.match(draft.error, message);
  }
  assert.equal(kiosk.buildLaunchRequest(form({ session: session({ campusId: null }), campusId: 'cam2' })).ok, true,
    'a session without a room can be launched from the chosen campus');
  assert.match(kiosk.launchErrorMessage(apiError(409, 'SESSION_NOT_LAUNCHABLE', { reason: 'ROSTER_TOO_LARGE' })), /30 students/);
  assert.match(kiosk.launchErrorMessage(apiError(403, 'ACCESS_DENIED')), /classes you teach/);
});

test('admin review wording stays neutral and resolution never claims to change attendance', () => {
  const item = { kind: 'CANDIDATE_SELECTION_MISMATCH', selectedRank: 3 };
  assert.match(review.kindExplanation(item), /third match/);
  assert.match(review.kindExplanation({ kind: 'NOT_ENROLLED_ATTEMPT' }), /No attendance was recorded/);
  assert.equal(review.resultLabel('BLOCKED_NOT_ENROLLED', null), 'Blocked; nothing recorded');
  assert.equal(review.resultLabel('ALREADY_RECORDED', 'PRESENT'), 'Already Present; no change');
  assert.equal(review.resolutionLabel(null), 'Open');
  assert.equal(review.noteError('a'.repeat(501)) !== null, true);
  assert.equal(review.noteError(` ${'a'.repeat(500)} `), null);
  assert.equal(review.formatReviewTime('2026-11-05T20:03:00Z'), '6 Nov, 09:03');
  assert.equal(review.studentLabel({ name: 'Minji Kim', studentNumber: 'S123' }), 'Minji Kim (S123)');
});

test('api errors expose problem code, reason and Retry-After; kiosk scope signs out a staff tab only', async () => {
  const { exports: api } = load(`export * from './lib/apiClient';`, {
    Headers,
    fetch: async () => ({ ok: false, status: 429, statusText: 'Too Many Requests',
      headers: { get: name => (name === 'Retry-After' ? '3' : null) },
      json: async () => ({ detail: 'Busy.', code: 'RECOGNIZER_BUSY', reason: 'X' }) })
  });
  const error = await api.request('/api/kiosk/device').catch(e => e);
  assert.equal(error.status, 429);
  assert.equal(error.code, 'RECOGNIZER_BUSY');
  assert.equal(error.reason, 'X');
  assert.equal(error.retryAfterSeconds, 3);
  assert.equal(error.message, 'Busy.');

  for (const [account, expected] of [['TEACHER:t1', 1], ['KIOSK:k1', 0]]) {
    let signOuts = 0;
    const { exports: scoped } = load(`export * from './lib/apiClient';`, {
      Headers,
      fetch: async () => ({ ok: false, status: 403, statusText: 'Forbidden', headers: { get: () => null },
        json: async () => ({ code: 'KIOSK_SCOPE', detail: 'This device is in kiosk mode.' }) })
    });
    scoped.setUnauthorizedHandler(() => signOuts++);
    scoped.setSessionAuthenticated(true, account);
    await scoped.request('/api/classes').catch(() => undefined);
    assert.equal(signOuts, expected, account);
  }
});

test('navigation adds the kiosk for staff and the review badge for admins only', () => {
  const { exports: nav } = load(`export * from './features/console-shell/consoleNavigation';`);
  const state = { students: [], events: [], sessions: [], sessionId: '', counts: { total: 0 },
    pendingAccomplishmentReviewCount: 0, awaitingReviewCount: 0, monitor: 'stopped' };
  const admin = nav.buildConsoleNavigation(state, true, '2026-11-05', 3);
  const teacher = nav.buildConsoleNavigation(state, false, '2026-11-05', 3);
  assert(admin.some(entry => entry.page === 'kiosk'));
  assert(teacher.some(entry => entry.page === 'kiosk'));
  assert.equal(admin.find(entry => entry.page === 'kiosk-reviews').count, '3');
  assert.equal(teacher.some(entry => entry.page === 'kiosk-reviews'), false);
  assert.equal(nav.buildConsoleNavigation(state, true, '2026-11-05', 0).find(e => e.page === 'kiosk-reviews').count, undefined);
  assert.equal(nav.buildConsoleNavigation(state, true, '2026-11-05', 250).find(e => e.page === 'kiosk-reviews').count, '99+');
});
