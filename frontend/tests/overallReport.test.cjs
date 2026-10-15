const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleOverallReport } = require('./overallReportFixtures.cjs');
const bundle = buildSync({
  stdin: { contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {OverallReportDocument, overallCompleteness} from './src/features/overall-reports/OverallReportDocument'; import {OverallReportScopeFields} from './src/features/overall-reports/OverallReportScopeFields'; export const render = report => renderToStaticMarkup(React.createElement(OverallReportDocument, {report})); export const renderScope = props => renderToStaticMarkup(React.createElement(OverallReportScopeFields, props)); export {overallCompleteness}; export * from './src/features/overall-reports/api';", resolveDir: path.join(__dirname, '..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
});
const compiled = new Module(__filename, module); compiled.filename = __filename; compiled.paths = module.paths;
compiled._compile(bundle.outputFiles[0].text, __filename);
const { render, renderScope, overallCompleteness, overallReportReviewApi: api, finalizeOverallReport, listOverallReports } = compiled.exports;

test('workspace overview prioritizes attendance evidence without changing the print document', () => {
  const output = buildSync({stdin:{contents:"import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {OverallReportSnapshotPanel} from './src/features/overall-reports/OverallReportSnapshotPanel';import {OverallCourseTable} from './src/features/overall-reports/OverallReportDocument';export const overview=(snapshot,audience)=>renderToStaticMarkup(React.createElement(OverallReportSnapshotPanel,{snapshot,audience}));export const table=(snapshot,compact)=>renderToStaticMarkup(React.createElement(OverallCourseTable,{snapshot,compact}));",resolveDir:path.join(__dirname,'..'),loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,loader:{'.css':'empty'},external:['react','react-dom','react-dom/server','react/jsx-runtime']});
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
  const report = exampleOverallReport(); report.document.audience = 'PARTNER';
  const html = render(report);
  assert(html.includes('Partner report')); assert(html.includes('For designated partners'));
  assert(!html.includes('Operational follow-up')); assert(!html.includes('Incomplete attendance'));
  assert(!html.includes('AVAILABLE'));
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
  global.fetch = async (url, init = {}) => { calls.push([url, init.method || 'GET', init.body && JSON.parse(init.body)]); return Response.json({}); };
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
