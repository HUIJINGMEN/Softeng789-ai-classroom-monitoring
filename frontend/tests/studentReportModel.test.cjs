const test = require('node:test');
const assert = require('node:assert/strict');
const model = require(process.env.STUDENT_REPORT_MODEL_PATH);
const approval = require(process.env.STUDENT_REPORT_APPROVAL_PATH);
const section = { topic: 'ATTENDANCE', title: 'Attendance', text: 'Saved text', reviewed: true, stale: false };
const report = { document: { sections: [section] } };
test('text edits invalidate review count without mutating saved content', () => {
  const edits = { ATTENDANCE: 'Changed text' };
  assert.equal(model.hasReportEdits(report, edits), true);
  assert.equal(model.reviewedSectionCount(report, edits), 0);
  assert.equal(section.text, 'Saved text');
});
test('unchanged saved text remains reviewed and stale evidence does not', () => {
  assert.equal(model.reviewedSectionCount(report, { ATTENDANCE: 'Saved text' }), 1);
  assert.equal(model.reviewedSectionCount({ document: { sections: [{ ...section, stale: true }] } }, {}), 0);
  assert.equal(model.hasReportEdits(null, {}), false);
});
test('section status distinguishes ungenerated drafts edits review and stale evidence', () => {
  assert.equal(model.sectionStatus({ ...section, text: '', reviewed: false }, false), 'Not generated');
  assert.equal(model.sectionStatus({ ...section, reviewed: false }, false), 'Needs review');
  assert.equal(model.sectionStatus(section, true), 'Unsaved changes');
  assert.equal(model.sectionStatus(section, false), 'Reviewed');
  assert.equal(model.sectionStatus({ ...section, stale: true }, true), 'Update needed');
});

const batch = (topics = ['ATTENDANCE', 'PAYMENTS', 'ABSENCES', 'LEARNING']) => ({
  id: 'report', version: 10, document: { sections: topics.map(topic => ({
    topic, title: topic, text: 'Draft ' + topic, reviewed: false, stale: false
  })) }
});
const save = async (current, topic, text, approve) => ({
  ...current, version: current.version + 1, document: { ...current.document,
    sections: current.document.sections.map(section => section.topic === topic ? { ...section, text, reviewed: approve } : section)
  }
});
test('bulk approval blocks missing text, cleared edits and changed evidence', () => {
  assert.match(model.reportApprovalBlocker(null, {}), /Load/);
  assert.match(model.reportApprovalBlocker(batch(), { PAYMENTS: '  ' }), /write every summary/);
  const changed = batch(); changed.document.sections[0].stale = true;
  assert.match(model.reportApprovalBlocker(changed, {}), /updated source records/);
  const empty = batch(); empty.document.sections[0].text = '';
  assert.equal(model.reportApprovalBlocker(empty, { ATTENDANCE: 'Manually written.' }), '');
});
test('batch generation includes outdated drafts without overwriting unaffected or unsaved wording', () => {
  const draft = batch();
  draft.document.sections[0].stale = true;
  draft.document.sections[1].stale = true;
  draft.document.sections[2].text = '';
  assert.deepEqual(model.reportDraftTargets(draft, { PAYMENTS: 'Unsaved correction' }).map(item => item.topic),
    ['ATTENDANCE', 'ABSENCES']);
  assert.equal(draft.document.sections[0].text, 'Draft ATTENDANCE');
  assert.deepEqual(model.reportDraftTargets(draft, { ATTENDANCE: 'Custom', PAYMENTS: 'Custom', ABSENCES: '' }), []);
});
test('bulk approval skips unchanged approved sections but includes their edited wording', () => {
  assert.deepEqual(model.pendingReportSections(report, {}), []);
  assert.deepEqual(model.pendingReportSections(report, { ATTENDANCE: 'Changed' }), [section]);
});
test('bulk approval saves current edits with each latest version and does not mutate the draft', async () => {
  const initial = batch(); const calls = []; const updates = [];
  const result = await approval.approveReportSections(initial, { PAYMENTS: 'Corrected payment wording' },
    async (current, topic, text, approve) => { calls.push([current.version, topic, text, approve]); return save(current, topic, text, approve); },
    (current, topic) => updates.push([current.version, topic]));
  assert.deepEqual(calls.map(call => call[0]), [10, 11, 12, 13]);
  assert.deepEqual(calls[1], [11, 'PAYMENTS', 'Corrected payment wording', true]);
  assert.equal(model.reviewedSectionCount(result, {}), 4);
  assert.equal(initial.version, 10); assert.equal(initial.document.sections[1].text, 'Draft PAYMENTS');
  assert.equal(updates.length, 4);
});
test('failure stops the batch and retry preserves completed approvals and remaining edits', async () => {
  const initial = batch(); const edits = { ATTENDANCE: 'Edited attendance', PAYMENTS: 'Edited payments', LEARNING: 'Edited feedback' };
  let latest = initial; const attempted = [];
  const onSaved = (current, topic) => { latest = current; delete edits[topic]; };
  await assert.rejects(approval.approveReportSections(initial, edits, async (current, topic, text, approve) => {
    attempted.push(topic);
    if (topic === 'PAYMENTS') throw new Error('Version conflict');
    return save(current, topic, text, approve);
  }, onSaved), error => error instanceof approval.ReportApprovalError && error.completed === 1 && error.total === 4 && error.topic === 'PAYMENTS');
  assert.deepEqual(attempted, ['ATTENDANCE', 'PAYMENTS']);
  assert.equal(latest.document.sections[0].reviewed, true);
  assert.deepEqual(edits, { PAYMENTS: 'Edited payments', LEARNING: 'Edited feedback' });
  const retried = [];
  latest = await approval.approveReportSections(latest, edits, async (current, topic, text, approve) => {
    retried.push(topic); return save(current, topic, text, approve);
  }, onSaved);
  assert.deepEqual(retried, ['PAYMENTS', 'ABSENCES', 'LEARNING']);
  assert.equal(latest.document.sections[3].text, 'Edited feedback');
  assert.equal(model.reviewedSectionCount(latest, {}), 4);
});
test('bulk approval supports optional achievements without hardcoded section counts', async () => {
  const initial = batch(['ATTENDANCE', 'PAYMENTS', 'ABSENCES', 'LEARNING', 'ACHIEVEMENTS']);
  const result = await approval.approveReportSections(initial, {}, save, () => {});
  assert.equal(model.reviewedSectionCount(result, {}), 5);
});
test('invalid bulk approval writes nothing and already approved reports need no writes', async () => {
  let calls = 0;
  const record = async (...args) => { calls++; return save(...args); };
  await assert.rejects(approval.approveReportSections(batch(), { ABSENCES: '' }, record, () => {}));
  await approval.approveReportSections(report, {}, record, () => {});
  assert.equal(calls, 0);
});
test('manual review of updated evidence allows bulk approval without regeneration', async () => {
  const draft = batch();
  Object.assign(draft.document.sections[0], { stale: true, fingerprint: 'new-evidence' });
  const acknowledgements = { ATTENDANCE: 'new-evidence' };
  assert.equal(model.reportApprovalBlocker(draft, {}, acknowledgements), '');
  assert.match(model.reportApprovalBlocker(draft, {}, { ATTENDANCE: 'old-evidence' }), /updated source records/);
  const calls = [];
  await approval.approveReportSections(draft, { ATTENDANCE: 'Human correction' },
    async (current, topic, text, approve, evidenceReviewed) => {
      calls.push([topic, text, evidenceReviewed]); return save(current, topic, text, approve);
    }, () => {}, acknowledgements);
  assert.deepEqual(calls[0], ['ATTENDANCE', 'Human correction', true]);
});
