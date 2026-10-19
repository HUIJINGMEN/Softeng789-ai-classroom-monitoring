const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({
  entryPoints: [path.join(__dirname, '../src/features/report-review/useReportReview.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  define: { 'import.meta.env': '{}' },
}).outputFiles[0].text;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const scope = { dateFrom: '2026-10-01', dateTo: '2026-10-19' };
const report = { id: 'draft', version: 3, document: { ...scope, sections: [] } };

function harness(saved = report, overrides = {}) {
  const values = [];
  const effects = [];
  let cursor = 0, mount = true, prepared = 0, loaded = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], next => {
        values[index] = typeof next === 'function' ? next(values[index]) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return values[index] ?? (values[index] = { current: initial });
    },
    useEffect(effect) { if (mount) effects.push(effect); },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require: id => id === 'react' ? react : require(id),
    Headers, fetch, Error, window: { confirm: () => true },
  });
  const api = {
    load: async () => { loaded++; return saved; },
    prepare: async () => { prepared++; return saved ?? report; },
    scopeValid: () => true,
    scopeChanged: () => false,
    ...overrides,
  };
  return {
    get prepared() { return prepared; },
    get loaded() { return loaded; },
    render() {
      cursor = 0;
      const result = module.exports.useReportReview(scope, api);
      mount = false;
      while (effects.length) effects.shift()();
      return result;
    },
  };
}

test('opening or reopening saved report state loads only; preparation is a distinct user action', async () => {
  for (const saved of [report, null]) {
    const h = harness(saved);
    h.render();
    await flush();
    let state = h.render();
    assert.equal(h.loaded, 1);
    assert.equal(h.prepared, 0);
    assert.equal(state.report, saved);
    if (saved) assert.equal(state.scopeChanged, true, 'saved snapshots require source refresh before editing');
    await state.reload();
    assert.equal(h.loaded, 2);
    assert.equal(h.prepared, 0);
    await h.render().prepare();
    state = h.render();
    assert.equal(h.prepared, 1);
    assert.equal(state.scopeChanged, false);
  }
});

test('a fully reviewed saved snapshot is not described as ready to deliver before source refresh', async () => {
  const saved = {
    ...report,
    document: {
      ...report.document,
      sections: [{
        topic: 'ATTENDANCE', title: 'Attendance', evidence: [], fingerprint: 'facts',
        text: 'Saved reviewed wording', provider: 'RECORDS', reviewed: true, stale: false,
        reviewedBy: 'Reviewer', reviewedAt: '2026-10-01T00:00:00Z',
      }],
    },
  };
  const h = harness(saved);
  h.render();
  await flush();
  assert.equal(h.render().reviewed, 1);
  assert.equal(h.render().ready, false);
  assert.equal(h.prepared, 0);
});

function editableReport() {
  return {
    ...report,
    document: {
      ...report.document,
      sections: ['ATTENDANCE', 'PAYMENTS'].map(topic => ({
        topic, title: topic, evidence: [], fingerprint: `${topic}-facts`,
        text: `${topic} original`, provider: 'RECORDS', reviewed: false, stale: false,
      })),
    },
  };
}

function savedSection(current, topic, text, reviewed = false) {
  return {
    ...current,
    version: current.version + 1,
    document: {
      ...current.document,
      sections: current.document.sections.map(section =>
        section.topic === topic ? { ...section, text, reviewed } : section),
    },
  };
}

async function preparedHarness(overrides = {}) {
  const h = harness(editableReport(), overrides);
  h.render();
  await flush();
  await h.render().prepare();
  return h;
}

test('single-section save accepts its version and preserves edits in other sections', async () => {
  const calls = [];
  const h = await preparedHarness({
    save: async (current, topic, text, approve) => {
      calls.push({ version: current.version, topic, approve });
      return savedSection(current, topic, text, approve);
    },
  });
  h.render().setEdits({ ATTENDANCE: 'Attendance edited', PAYMENTS: 'Payments edited' });
  await h.render().save('ATTENDANCE', false);
  const state = h.render();
  assert.deepEqual(calls, [{ version: 3, topic: 'ATTENDANCE', approve: false }]);
  assert.equal(state.report.version, 4);
  assert.equal(state.edits.ATTENDANCE, undefined);
  assert.equal(state.edits.PAYMENTS, 'Payments edited');
  assert.equal(state.dirty, true);
});

for (const action of ['saveAll', 'approveAll']) {
  test(`${action} preserves the failed section and carries forward successful versions`, async () => {
    const calls = [];
    const h = await preparedHarness({
      save: async (current, topic, text, approve) => {
        calls.push({ version: current.version, topic, approve });
        if (topic === 'PAYMENTS') throw new Error('Version conflict');
        return savedSection(current, topic, text, approve);
      },
    });
    h.render().setEdits({ ATTENDANCE: 'Attendance edited', PAYMENTS: 'Payments edited' });
    await h.render()[action]();
    const state = h.render();
    assert.deepEqual(calls.map(call => call.version), [3, 4]);
    assert.equal(calls.every(call => call.approve === (action === 'approveAll')), true);
    assert.equal(state.report.version, 4);
    assert.equal(state.edits.ATTENDANCE, undefined);
    assert.equal(state.edits.PAYMENTS, 'Payments edited');
    assert.match(state.error, /Version conflict/);
    assert.equal(state.busy, null);
  });
}

test('regenerating one section clears only its replaced wording', async () => {
  const h = await preparedHarness({
    generate: async (current, topic) => savedSection(current, topic, 'Regenerated wording'),
  });
  h.render().setEdits({ ATTENDANCE: 'Replace this edit', PAYMENTS: 'Keep this edit' });
  await h.render().generate('ATTENDANCE');
  const state = h.render();
  assert.equal(state.report.version, 4);
  assert.equal(state.edits.ATTENDANCE, undefined);
  assert.equal(state.edits.PAYMENTS, 'Keep this edit');
});

test('read-only reload resets editor state and removes preparation permission', async () => {
  const h = await preparedHarness();
  h.render().setEdits({ ATTENDANCE: 'Unsaved edit' });
  h.render().setAcknowledgements({ ATTENDANCE: 'ATTENDANCE-facts' });
  assert.equal(h.render().scopeChanged, false);
  await h.render().reload();
  const state = h.render();
  assert.equal(Object.keys(state.edits).length, 0);
  assert.equal(Object.keys(state.acknowledgements).length, 0);
  assert.equal(state.scopeChanged, true);
  assert.equal(h.prepared, 1, 'reload never invokes preparation');
});

test('failed preparation preserves unsaved wording rather than applying a reset', async () => {
  let fail = false;
  const saved = editableReport();
  const h = await preparedHarness({
    prepare: async () => {
      if (fail) throw new Error('Source unavailable');
      return saved;
    },
  });
  h.render().setEdits({ ATTENDANCE: 'Keep until successful refresh' });
  fail = true;
  await h.render().prepare();
  const state = h.render();
  assert.equal(state.edits.ATTENDANCE, 'Keep until successful refresh');
  assert.match(state.error, /Source unavailable/);
  assert.equal(state.report.version, saved.version);
  assert.equal(state.busy, null);
});
