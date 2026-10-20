const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleOverallReport, exampleOverallReportWithRoster } = require('./overallReportFixtures.cjs');
const bundle = buildSync({
  stdin: { contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {OverallReportDocument} from './src/features/overall-reports/OverallReportDocument'; import {recordingCompleteness as overallCompleteness, recordedMarks, reportRate} from './src/features/report-review/reportAttendance'; import {OverallReportScopeFields} from './src/features/overall-reports/OverallReportScopeFields'; export const render = report => renderToStaticMarkup(React.createElement(OverallReportDocument, {report})); export const renderScope = props => renderToStaticMarkup(React.createElement(OverallReportScopeFields, props)); export {overallCompleteness, recordedMarks, reportRate}; export * from './src/features/overall-reports/api';", resolveDir: path.join(__dirname, '..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
});
const compiled = new Module(__filename, module); compiled.filename = __filename; compiled.paths = module.paths;
compiled._compile(bundle.outputFiles[0].text, __filename);
const { render, renderScope, overallCompleteness, recordedMarks, reportRate, overallReportReviewApi: api, finalizeOverallReport, listOverallReports } = compiled.exports;

test('workspace overview prioritizes attendance evidence without changing the print document', () => {
  const output = buildSync({stdin:{contents:"import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {OverallReportSnapshotPanel} from './src/features/overall-reports/OverallReportSnapshotPanel';import {OverallCourseTable} from './src/features/overall-reports/OverallCourseTable';export const overview=(snapshot,audience)=>renderToStaticMarkup(React.createElement(OverallReportSnapshotPanel,{snapshot,audience}));export const table=(snapshot,compact)=>renderToStaticMarkup(React.createElement(OverallCourseTable,{snapshot,compact}));",resolveDir:path.join(__dirname,'..'),loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,loader:{'.css':'empty'},external:['react','react-dom','react-dom/server','react/jsx-runtime']});
  const loaded=new Module(__filename,module);loaded.paths=module.paths;loaded._compile(output.outputFiles[0].text,__filename);
  const report=exampleOverallReport();const html=loaded.exports.overview(report.document.snapshot,'PARTNER');
  for(const value of ['Evidence overview','Partner report','83%','60%','5 of 6 recorded marks','6 of 10 expected marks','Courses','Distinct students','Completed sessions'])assert(html.includes(value),value);
  const compact=loaded.exports.table(report.document.snapshot,true);
  assert(compact.includes('3 students'));assert(compact.includes('5 sessions'));
  assert(!compact.includes('<th scope="col">Students</th>'));assert(compact.includes('<th scope="col">Attendance</th>'));
  const printed=render(report);assert(printed.includes('overall-report-metrics'));assert(!printed.includes('Evidence overview'));
  assert(printed.includes('<th scope="col">Students</th>'));assert(printed.includes('<th scope="col">Sessions</th>'));
  const empty={...report.document.snapshot,attendance:{completed:0,present:0,late:0,absent:0,unrecorded:0,rate:null}};
  const unavailable=loaded.exports.overview(empty,'INTERNAL');assert(!unavailable.includes('NaN'));assert(!unavailable.includes('100%'));
});

test('workspace follow-up groups repeated guidance and retains every count and class action', () => {
  const output = buildSync({
    stdin: {
      contents: `import React from 'react';
        import {renderToStaticMarkup} from 'react-dom/server';
        import {OverallReportFollowUp} from './src/features/overall-reports/OverallReportFollowUp';
        import {OverallReportReviewStatus} from './src/features/overall-reports/OverallReportReviewStatus';
        export const followUp = snapshot => renderToStaticMarkup(React.createElement(OverallReportFollowUp, {snapshot, onOpenCourse() {}}));
        export const status = props => renderToStaticMarkup(React.createElement(OverallReportReviewStatus, props));`,
      resolveDir: path.join(__dirname, '..'), loader: 'tsx',
    },
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  });
  const loaded = new Module(__filename, module);
  loaded.paths = module.paths; loaded._compile(output.outputFiles[0].text, __filename);
  const snapshot = exampleOverallReport().document.snapshot;
  snapshot.actions.push({ ...snapshot.actions[0], courseOfferingId: 'second-course', courseLabel: 'TEST 202', count: 7 });
  const before = JSON.stringify(snapshot);
  const html = loaded.exports.followUp(snapshot);
  assert.equal((html.match(/class="overall-follow-up-group"/g) || []).length, 1);
  assert.equal(html.split('Record missing attendance.').length - 1, 1);
  assert(html.includes('TEST 101')); assert(html.includes('TEST 202'));
  assert(html.includes('<strong>4</strong>')); assert(html.includes('<strong>7</strong>'));
  assert(html.includes('Open class: TEST 101')); assert(html.includes('Open class: TEST 202'));
  assert(!html.includes('<details class="overall-follow-up-group" open'));
  assert.equal(JSON.stringify(snapshot), before);
  assert(loaded.exports.followUp({ ...snapshot, actions: [] }).includes('No follow-up flags'));
  const pending = loaded.exports.status({ reviewed: 0, total: 4, status: 'Review the wording.' });
  assert(pending.includes('0 of 4 reviewed'));
  assert.match(pending, /<progress[^>]*aria-label="Summary review progress"[^>]*value="0"[^>]*max="4"/);
  assert(pending.includes('data-complete="false"'));
  const complete = loaded.exports.status({ reviewed: 4, total: 4, status: 'Preview before exporting.' });
  assert(complete.includes('data-complete="true"')); assert(complete.includes('value="4"'));
  assert(loaded.exports.status({ reviewed: 0, total: 0, status: 'Loading.' }).includes('data-complete="false"'));
});

test('overall preview distinguishes frozen exports and requires partner privacy review without adding UI to the print document', () => {
  const fs = require('node:fs');
  const previewBundle = buildSync({
    entryPoints: [path.join(__dirname, '../src/features/overall-reports/OverallReportPreview.tsx')],
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' },
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
  });
  const previewModule = new Module(__filename, module);
  previewModule.filename = __filename; previewModule.paths = module.paths;
  previewModule._compile(previewBundle.outputFiles[0].text, __filename);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const renderPreview = report => renderToStaticMarkup(React.createElement(previewModule.exports.OverallReportPreview, { report, onClose() {} }));
  const report = exampleOverallReport();
  const draft = renderPreview(report);
  assert(draft.includes('Report preview')); assert(draft.includes('Ready to export'));
  assert(draft.includes('Print settings &amp; sharing'));
  assert(!draft.includes('class="overall-report-privacy"'));
  const partner = renderPreview({ ...report, document: { ...report.document, audience: 'PARTNER' } });
  assert(partner.includes('class="overall-report-privacy"'));
  assert.match(partner, /disabled=""[^>]*>Print \/ save PDF/);
  const saved = renderPreview({ ...report, finalizedAt: '2026-10-13T01:00:00Z' });
  assert(saved.includes('Saved report · Reprint this frozen version.'));
  assert(saved.includes('Facts and wording are frozen.'));
  const printDocument = saved.split('class="overall-report-print"')[1];
  assert(printDocument); assert(!printDocument.includes('Print settings'));
  const css = fs.readFileSync(path.join(__dirname, '../src/features/overall-reports/overall-report-preview.css'), 'utf8');
  assert.match(css, /\.overall-report-preview-body\s*\{[^}]*overflow-y: auto;/);
  assert.match(css, /\.overall-report-preview-modal\s*\{[^}]*overflow: hidden;/);
  assert(css.includes('.overall-report-preview-body > .overall-report-document'));
});

test('overall styles keep an explicit cascade and print rules separate from screen editing', () => {
  const fs = require('node:fs');
  const base = path.join(__dirname, '../src/features/overall-reports');
  const manifest = fs.readFileSync(path.join(base, 'overall-report.css'), 'utf8');
  const files = [...manifest.matchAll(/@import "\.\/([^"\n]+)";/g)].map(match => match[1]);
  assert.deepEqual(files, ['overall-report-workspace.css', 'overall-report-preview.css', 'overall-report-document.css', 'overall-report-responsive.css', 'overall-report-print.css']);
  for (const file of files.slice(0, -1)) assert(!fs.readFileSync(path.join(base, file), 'utf8').includes('@page'), file);
  const print = fs.readFileSync(path.join(base, files.at(-1)), 'utf8');
  assert(print.includes('@page classlens-overall-report'));
  assert(print.includes('@media print'));
  assert.match(print, /\.overall-report-print \.report-student-roster\s*\{[^}]*break-before: page/);
  const sourceCss = fs.readFileSync(path.join(base, '../report-review/report-sources.css'), 'utf8');
  assert.match(sourceCss, /\.report-source-table thead\s*\{[^}]*break-after: avoid/);
  assert.match(sourceCss, /\.report-source-table tbody > tr:first-child\s*\{[^}]*break-before: avoid/);
});

test('document groups repeated follow-up guidance once but preserves every course and issue count', () => {
  const report = exampleOverallReport();
  report.document.snapshot.actions.push({ ...report.document.snapshot.actions[0], courseOfferingId: 'course-2',
    courseLabel: 'TEST 202', count: 7 });
  report.document.snapshot.actions.push({ courseOfferingId: 'course-2', courseLabel: 'TEST 202',
    issue: 'Recorded absences', count: 2, nextStep: 'Check absence arrangements.' });
  const before = JSON.stringify(report.document.snapshot.actions), html = render(report);
  assert(html.includes('overall-report-action-table')); assert(html.includes('TEST 101 · 4')); assert(html.includes('TEST 202 · 7'));
  assert(html.includes('TEST 202 · 2')); assert.equal(html.split('Record missing attendance.').length - 1, 1);
  assert(html.includes('Check absence arrangements.')); assert.equal(JSON.stringify(report.document.snapshot.actions), before);
  const partner = render({ ...report, document: { ...report.document, audience: 'PARTNER' } });
  assert(!partner.includes('overall-report-action-table'));
});

test('compact overall scope preserves labelled audience controls, stable help trigger and apply states', () => {
  const props = { scope: exampleOverallReport().document, onChange() {}, disabled: false, valid: true, changed: false, courses: [], loading: false, onApply() {} };
  const html = renderScope(props);
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert(html.includes('<legend>Report audience</legend>'));
  assert(html.includes('aria-haspopup="dialog"'));
  assert(html.includes('aria-labelledby="overall-report-courses-label overall-report-courses-value"'));
  assert(html.includes('overall-report-help-trigger'));
  assert(html.includes('aria-expanded="false"'));
  assert(!html.includes('<summary>About this report</summary>'));
  assert(html.includes('Refresh records'));
  const changed = renderScope({ ...props, changed: true });
  assert(changed.includes('btn btn--primary')); assert(changed.includes('Apply scope'));
  const invalid = renderScope({ ...props, valid: false });
  assert(invalid.includes('role="alert"')); assert(invalid.includes('disabled=""'));
  const loading = renderScope({ ...props, disabled: true, loading: true });
  assert(loading.includes('Working…')); assert(loading.includes('Loading courses…'));
});

test('overall document presents distinct students, weighted attendance, completeness and operational follow-up without financial data', () => {
  const report = exampleOverallReport(), html = render(report);
  for (const text of ['Internal operations report', 'Distinct students', '83%', '60%', 'Course comparison', 'Operational follow-up', 'Incomplete attendance', 'Overall attendance by week', 'across the reporting scope', 'Recorded achievements', 'Report Reviewer']) assert(html.includes(text), text);
  for (const text of ['PRIVATE SOURCE RECORD', 'QWEN', 'Invoice records', 'Student attendance register', 'Sign out', 'Admin scope']) assert(!html.includes(text), text);
  assert.equal(overallCompleteness(report.document.snapshot.attendance), 60);
});
test('partner document defensively hides operational actions even for a malformed internal snapshot', () => {
  const report = exampleOverallReportWithRoster(); report.document.audience = 'PARTNER';
  report.document.snapshot.studentDetails = [{ name: 'Private Student', number: 'QA-000' }];
  const html = render(report);
  assert(html.includes('Partner report')); assert(html.includes('For designated partners'));
  assert(!html.includes('Operational follow-up')); assert(!html.includes('Incomplete attendance'));
  assert(!html.includes('AVAILABLE'));
  assert(!html.includes('Courses with follow-up flags'));
  for (const value of ['Private Student', 'QA-000', 'PRIVATE TEACHER EXCERPT', 'Confirmed milestone', 'Student overview', 'Student follow-up']) assert(!html.includes(value), value);
  for (const value of ['Students in this report', 'Example Student', 'EXAMPLE001', 'EXAMPLE002', 'EXAMPLE003']) assert(!html.includes(value), value);
});
test('internal overall roster identifies distinct students and keeps raw attendance totals consistent', () => {
  const report = exampleOverallReportWithRoster(), html = render(report);
  for (const value of ['Students in this report', 'Example Student', 'EXAMPLE001', 'Second Student', 'EXAMPLE002', 'Third Student', 'EXAMPLE003', '3 distinct students', '3 / 4 recorded', '2 / 3 recorded']) assert(html.includes(value), value);
  const rows = report.document.snapshot.students;
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const field of ['completed', 'present', 'late', 'absent', 'unrecorded']) assert.equal(rows.reduce((sum, row) => sum + row.attendance[field], 0), report.document.snapshot.attendance[field], field);
  rows[0].name = '<script>student</script>';
  assert(render(report).includes('&lt;script&gt;student')); assert(!render(report).includes('<script>'));
});
test('overall roster does not invent names for older frozen exports', () => {
  assert(render(exampleOverallReport()).includes('no stored student roster'));
  const report = exampleOverallReport(); report.document.snapshot.students = [];
  assert(render(report).includes('No students in the historical enrolment scope'));
});

test('retired private personal appendices are not restored in either overall edition', () => {
  for (const audience of ['INTERNAL', 'PARTNER']) {
    const report = exampleOverallReport(audience);
    report.document.snapshot.studentDetails = [{ name: 'Private Student', number: 'PRIVATE-ID',
      feedback: [{ excerpt: 'PRIVATE PERSONAL FEEDBACK' }], achievements: [{ title: 'PRIVATE AWARD' }] }];
    const html = render(report);
    for (const value of ['Private Student', 'PRIVATE-ID', 'PRIVATE PERSONAL FEEDBACK', 'PRIVATE AWARD',
      'Student overview', 'Student follow-up', 'Student learning evidence', 'no student-detail snapshot']) assert(!html.includes(value), value);
    for (const value of ['Distinct students', 'Course comparison', '83%', '60%', 'Teacher feedback coverage']) assert(html.includes(value), value);
  }
});
test('overall content includes denominators, weekly counts and feedback coverage from the frozen snapshot', () => {
  const report = exampleOverallReport();
  const html = render(report);
  for (const value of ['Record coverage &amp; limitations', 'Weekly attendance detail', 'Teacher feedback coverage',
    'Class-wide teacher notes by course', '4 present', '1 late', '4 missing', '6 / 10', '5 / 6',
    'one student in one lesson', 'not assigned or completed tasks', 'partial first and last weeks']) assert(html.includes(value), value);
  report.document.snapshot.courses.push({ ...report.document.snapshot.courses[0], id: 'empty-course', code: 'EMPTY 101',
    completedSessions: 0, feedbackCount: 0, attendance: { completed: 0, present: 0, late: 0, absent: 0, unrecorded: 0, rate: null } });
  const sparse = render(report);
  assert(sparse.includes('No class-wide feedback recorded')); assert(sparse.includes('EMPTY 101'));
  assert(!sparse.includes('NaN')); assert(!sparse.includes('Infinity'));
});
test('empty evidence does not imply perfect attendance and optional achievements disappear', () => {
  const report = exampleOverallReport(), a = { completed: 0, present: 0, late: 0, absent: 0, unrecorded: 0, rate: null };
  Object.assign(report.document.snapshot, { attendance: a, attendanceTrend: [], courses: [], achievements: 0, actions: [], confirmedEvents: [] });
  report.document.sections[0].text = 'Reviewed <script>unsafe</script>';
  const html = render(report);
  assert.equal(overallCompleteness(a), null); assert(!html.includes('NaN'));
  assert(html.includes('No completed sessions to chart')); assert(!html.includes('Recorded achievements'));
  assert(html.includes('&lt;script&gt;')); assert(!html.includes('<script>'));
});
test('overall API binds audience and scope, rejects invalid ranges and sends version plus privacy acknowledgement', async () => {
  const original = global.fetch, calls = [], report = exampleOverallReport(), scope = { ...report.document, sections: undefined, snapshot: undefined };
  global.fetch = async (url, init = {}) => { if(url==='/api/auth/csrf') return Response.json({headerName:'X-CSRF-TOKEN',token:'test-csrf'}); calls.push([url, init.method || 'GET', init.body && JSON.parse(init.body)]); return Response.json({}); };
  try {
    assert(api.scopeValid(scope)); assert(!api.scopeChanged(scope, report));
    assert(api.scopeChanged({ ...scope, audience: 'PARTNER' }, report));
    assert(!api.scopeValid({ ...scope, dateTo: '2026-01-01' }));
    assert(!api.scopeValid({ ...scope, dateTo: '2028-01-01' }));
    assert(!api.scopeValid({ ...scope, courseOfferingIds: Array(101).fill('id') }));
    await api.prepare(scope); await api.generate(report, 'LEARNING');
    await api.save(report, 'ATTENDANCE', 'Checked wording', true, true);
    await finalizeOverallReport(report, true); await listOverallReports();
    assert(calls[0][0].endsWith('/overall-reports/prepare'));
    assert.deepEqual(calls[1].slice(1), ['POST', { version: 2 }]);
    assert.deepEqual(calls[2].slice(1), ['PUT', { version: 2, text: 'Checked wording', approve: true, evidenceReviewed: true }]);
    assert.deepEqual(calls[3].slice(1), ['POST', { version: 2, privacyReviewed: true }]);
    assert(calls[4][0].endsWith('/overall-reports/history'));
  } finally { global.fetch = original; }
});

test('shared attendance presentation keeps unknown marks separate and zero rates available', () => {
  const sparse = { completed: 8, present: 3, late: 1, absent: 2, unrecorded: 2, rate: 67 };
  assert.equal(recordedMarks(sparse), 6); assert.equal(overallCompleteness(sparse), 75);
  assert.equal(reportRate(sparse.rate), '67%'); assert.equal(reportRate(0), '0%');
  assert.equal(reportRate(null), '—'); assert.equal(reportRate(null, 'Not available'), 'Not available');
  const unknown = { completed: 4, present: 0, late: 0, absent: 0, unrecorded: 4, rate: null };
  assert.equal(recordedMarks(unknown), 0); assert.equal(overallCompleteness(unknown), 0);
  assert.equal(overallCompleteness({ ...unknown, completed: 0, unrecorded: 0 }), null);
  assert.deepEqual(sparse, { completed: 8, present: 3, late: 1, absent: 2, unrecorded: 2, rate: 67 });
});
