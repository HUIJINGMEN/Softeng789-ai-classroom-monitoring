const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleClassReport } = require('./classReportFixtures.cjs');
const bundle = buildSync({
  stdin: { contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {ClassReportDocument, classReportFilename} from './src/features/class-reports/ClassReportDocument'; export const render = report => renderToStaticMarkup(React.createElement(ClassReportDocument, {report})); export {classReportFilename};", resolveDir: path.join(__dirname, '..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
});
const compiled = new Module(__filename, module); compiled.filename = __filename; compiled.paths = module.paths;
compiled._compile(bundle.outputFiles[0].text, __filename);
const { render, classReportFilename } = compiled.exports;

test('class document contains class facts, weighted charts, currencies and both registers without source records or app navigation', () => {
  const html = render(exampleClassReport());
  for (const text of ['Class report · Staff only', 'Class report example', 'Teaching term', 'Example Teacher', 'Data as of', '6 of 8 expected student marks', '67%', 'Recording completeness', '75%', 'Class attendance by week', 'across this class', 'NZD 250.00', 'USD 100.00', 'class-wide teacher feedback', 'Student attendance register', 'EXAMPLE-002', 'Completed session register', 'Room 1', 'Reviewed by']) assert(html.includes(text), text);
  for (const text of ['PRIVATE SOURCE RECORD', 'QWEN:test', "This student&#x27;s weekly", 'Admin scope', 'Skip to main content', 'Email student']) assert(!html.includes(text), text);
});
test('empty class has unavailable rates and no forced achievement or false cleared-account claim', () => {
  const report = exampleClassReport(), snapshot = report.document.snapshot;
  snapshot.students = []; snapshot.sessions = []; snapshot.completedSessions = 0;
  snapshot.attendance = { completed: 0, present: 0, late: 0, absent: 0, unrecorded: 0, rate: null };
  snapshot.attendanceTrend = []; snapshot.confirmedEvents = []; snapshot.payments.totals = [];
  const html = render(report);
  assert(html.includes('No completed sessions to chart'));
  assert(html.includes('does not mean no fees are due'));
  assert(!html.includes('NaN')); assert(!html.includes('<h2>Class achievements</h2>'));
  assert(html.includes('<dd>—</dd>'));
});
test('class narrative keeps reviewed wording escaped and omits retired achievements from older documents', () => {
  const report = exampleClassReport();
  report.document.sections[3].text = 'Summary\n\nStrengths\nCareful work.\n\nNext steps\nPractise <script>proofs</script>.';
  report.document.sections.push({ ...report.document.sections[0], topic: 'ACHIEVEMENTS', title: 'Class achievements', text: 'A recorded individual award.', reviewedBy: 'Retired award reviewer' });
  const html = render(report);
  assert(html.includes('<h3>Strengths</h3>')); assert(html.includes('<h3>Next steps</h3>'));
  assert(html.includes('&lt;script&gt;')); assert(!html.includes('<script>'));
  assert(!html.includes('<h2>Class achievements</h2>'));
  assert(!html.includes('A recorded individual award.'));
  assert(!html.includes('Retired award reviewer'));
  assert.equal((html.match(/TEST 101 · TEST 101/g) || []).length, 0);
  report.classLabel = 'TEST / 101';
  assert.equal(classReportFilename(report), 'Class report - TEST  101 - 2026-08-12 to 2026-10-12');
});
