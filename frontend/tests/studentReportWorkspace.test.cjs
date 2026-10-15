const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleReport } = require('./studentReportFixtures.cjs');
const bundled = buildSync({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    export * from './src/features/student-reports/workspaceModel';
    export * from './src/features/report-review/reportDraftSave';
    import {StudentReportChecks} from './src/features/student-reports/StudentReportChecks';
    import {StudentReportTaskRow} from './src/features/student-reports/StudentReportTaskRow';
    export const renderTask = task => renderToStaticMarkup(React.createElement('table', {}, React.createElement('tbody', {}, React.createElement(StudentReportTaskRow, {task, opening:false, onContinue:()=>{}, onOpenSaved:()=>{}, onOpenRecords:()=>{}}))));
    export const renderChecks = report => renderToStaticMarkup(React.createElement(StudentReportChecks, {report, disabled:false, onOpenRecords:()=>{}}));`,
    resolveDir: path.join(__dirname, '..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
  external: ['react', 'react-dom/server', 'react/jsx-runtime']
});
const compiled = new Module(__filename, module); compiled.paths = module.paths;
compiled._compile(bundled.outputFiles[0].text, __filename);
const { reportTaskStatus, studentReportTasks, saveReportDrafts, ReportDraftSaveError, renderChecks, renderTask } = compiled.exports;

test('queue distinguishes saved progress, outdated review, publication and a new draft', () => {
  assert.equal(reportTaskStatus(), 'Not started');
  const draft = { sections: 4, drafted: 2, reviewed: 0, stale: false };
  assert.equal(reportTaskStatus({ draft }), 'Drafting');
  draft.drafted = 4;
  assert.equal(reportTaskStatus({ draft }), 'Needs review');
  draft.reviewed = 4;
  assert.equal(reportTaskStatus({ draft }), 'Reviewed');
  draft.stale = true;
  assert.equal(reportTaskStatus({ draft }), 'Needs review');
  assert.equal(reportTaskStatus({ published: { id: 'published' } }), 'Published');
  assert.equal(reportTaskStatus({ draft, published: { id: 'published' } }), 'Needs review');
  assert.equal(reportTaskStatus({ otherDraft: draft }), 'Not started');
});
test('tasks never infer enrolment from a course code or include another offering of the same course', () => {
  const courses = [{ id: 'term1', label: 'TEST 101 · Term 1' }, { id: 'term2', label: 'TEST 101 · Term 2' }];
  const students = [{ recordId: 'real-id', id: 'DEMO', name: 'Example', registrationPhoto:'/api/students/real-id/photo', course: 'TEST 101', courseOfferingIds: ['term1'] },
    { recordId: 'unmapped', id: 'OTHER', name: 'Other', course: 'TEST 101' }];
  const tasks = studentReportTasks(students, courses, '2026-09-01', '2026-09-30', '');
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].scope.courseOfferingIds, ['term1']);
  assert.equal(tasks[0].scope.studentId, 'real-id');
  assert.equal(tasks[0].photoUrl, '/api/students/real-id/photo');
  assert.equal(studentReportTasks(students, courses, '2026-09-01', '2026-09-30', 'term2').length, 0);
});
test('save all saves only changed sections sequentially without approving', async () => {
  const report = exampleReport(); const writes = []; const completed = [];
  const result = await saveReportDrafts(report, { ATTENDANCE: 'Edited attendance', PAYMENTS: 'Edited payment', LEARNING: report.document.sections[3].text },
    async (current, topic, text, approve) => { writes.push([current.version, topic, text, approve]); return { ...current, version: current.version + 1 }; },
    (next, topic) => completed.push(topic));
  assert.deepEqual(writes.map(w => [w[0], w[1], w[3]]), [[1, 'ATTENDANCE', false], [2, 'PAYMENTS', false]]);
  assert.equal(result.version, 3); assert.deepEqual(completed, ['ATTENDANCE', 'PAYMENTS']);
});
test('save all reports partial progress and stops after a failure', async () => {
  const report = exampleReport(); const completed = [];
  await assert.rejects(saveReportDrafts(report, { ATTENDANCE: 'Edited attendance', PAYMENTS: 'Edited payment', LEARNING: 'Edited feedback' },
    async (current, topic) => { if (topic === 'PAYMENTS') throw Error('Conflict'); return { ...current, version: current.version + 1 }; },
    (next, topic) => completed.push(topic)), cause => cause instanceof ReportDraftSaveError && cause.completed === 1 && cause.total === 3 && cause.topic === 'PAYMENTS');
  assert.deepEqual(completed, ['ATTENDANCE']);
});
test('empty changed summaries block save all before any write', async () => {
  let writes = 0;
  await assert.rejects(saveReportDrafts(exampleReport(), { ATTENDANCE: 'Edited', PAYMENTS: ' ' }, async () => { writes++; }, () => {}), /summary is empty/);
  assert.equal(writes, 0);
});
test('readiness gaps are contextual and not falsely treated as absences or achievements', () => {
  const report = exampleReport(); report.document.snapshot.feedbackCount = 0;
  const html = renderChecks(report);
  for (const text of ['2 unrecorded', 'TEST 101', 'These are not absences', 'you can continue', 'No teacher feedback', 'that section is omitted', 'View student details', 'Refresh source records']) assert(html.includes(text), text);
  assert(!html.includes('role="alert"'));
});
test('queue rows expose scoped courses, review counts and named actions with distinct attention states', () => {
  const task = { studentId:'example', name:'Example Student', number:'DEMO-1', courses:[{id:'course-1',label:'TEST 101 · Term 1'},{id:'course-2',label:'TEST 202 · Term 2'}],
    progress:{draft:{sections:4,drafted:4,reviewed:2,stale:true}} };
  const html = renderTask(task);
  for (const text of ['badge--warn', 'Needs review', '<b>4/4</b> written', '<b>2/4</b> reviewed', 'Sources changed', 'TEST 101 · Term 1', 'TEST 202 · Term 2', 'aria-label="Continue draft for Example Student"', 'aria-label="View student details for Example Student"']) assert(html.includes(text), text);
  const fresh = renderTask({...task, progress:undefined});
  assert(fresh.includes('badge--neutral'));
  assert(fresh.includes('aria-label="Start report for Example Student"'));
});
test('published-only queue rows do not claim a missing draft and preserve other-scope draft access', () => {
  const task = {studentId:'example',name:'Example Student',number:'DEMO-1',courses:[],progress:{published:{id:'published'},otherDraft:{dateFrom:'2026-07-01',dateTo:'2026-07-31',courseLabels:['Previous course']}}};
  const html = renderTask(task);
  assert(html.includes('badge--success'));
  assert(html.includes('View published report for Example Student'));
  assert(!html.includes('No draft for the selected dates and courses'));
  assert(html.includes('Saved for a different selection'));
  assert(html.includes('Open saved draft for Example Student:'));
  assert(!html.includes('Student records'));
  assert(html.includes('Previous course'));
});
test('student report identity uses the actual photo when supplied and initials when absent', () => {
  const task = { studentId:'example',name:'Example Student',number:'DEMO-1',courses:[] };
  const photo = renderTask({...task,photoUrl:'/api/students/example/photo'});
  assert(photo.includes('class="person__photo"'));
  assert(photo.includes('src="/api/students/example/photo"'));
  assert(photo.includes('alt=""'));
  const fallback = renderTask(task);
  assert(fallback.includes('student-report-queue__avatar'));
  assert(fallback.includes('>ES</div>'));
  assert(!fallback.includes('<img'));
});
