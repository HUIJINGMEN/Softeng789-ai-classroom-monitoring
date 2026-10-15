const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleReport, exampleReportWithSources } = require('./studentReportFixtures.cjs');
const bundled = buildSync({
  stdin: { contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {StudentReportDocument} from './src/features/student-reports/StudentReportDocument'; export const render = report => renderToStaticMarkup(React.createElement(StudentReportDocument, {report}));", resolveDir: path.join(__dirname, '..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
});
const compiled = new Module(__filename, module);
compiled.filename = __filename;
compiled.paths = module.paths;
compiled._compile(bundled.outputFiles[0].text, __filename);
const { render } = compiled.exports;

test('complete student report includes profile, course facts, charts, payment facts and reviewed narratives', () => {
  const html = render(exampleReport());
  for (const text of ['EXAMPLE-001', 'student@example.test', 'Engineering', 'Software engineering', 'Example Teacher', '67%',
    'Attendance distribution', 'Weekly attendance', 'Student course record', 'Student attendance', 'Hand raise', 'Discussion',
    'Confirmed receipts', 'Awaiting verification', 'EXAMPLE-INV-001', 'Teacher feedback summary', '<h3>Strengths</h3>', '<h3>Next steps</h3>']) assert(html.includes(text), text);
  assert(!html.includes('PRIVATE SOURCE RECORD'));
  assert(!html.includes('QWEN:test'));
  assert(!html.includes('<h2>Achievements</h2>'));
});
test('zero records remain unavailable instead of reporting perfect attendance or a cleared account', () => {
  const report = exampleReport(); const facts = report.document.snapshot;
  facts.attendance = { completed: 0, present: 0, late: 0, absent: 0, unrecorded: 0, rate: null };
  facts.courses[0].attendance = facts.attendance;
  facts.attendanceTrend = []; facts.confirmedEvents = []; facts.feedbackCount = 0; facts.payments.invoices = [];
  report.document.sections[3].text = 'No teacher feedback recorded for the selected courses and dates.';
  const html = render(report);
  assert(html.includes('Not available'));
  assert(html.includes('No completed sessions to chart'));
  assert(html.includes('No confirmed observations recorded'));
  assert(html.includes('does not mean no fees are due'));
  assert(html.includes('<h2>Teacher feedback summary</h2>'));
  assert.equal((html.match(/No teacher feedback recorded/g) || []).length, 1);
  assert(!html.includes('NaN')); assert(!html.includes('<h3>Strengths</h3>'));
});
test('old reports cannot silently gain current profile or chart facts', () => {
  const report = exampleReport(); delete report.document.snapshot;
  const html = render(report);
  assert(html.includes('no saved chart or profile snapshot'));
  assert(!html.includes('Weekly attendance'));
  assert(!html.includes('EXAMPLE-001'));
});
test('personal report excludes classroom metadata and does not repeat identical course code and name', () => {
  const report = exampleReport();
  const course = report.document.snapshot.courses[0];
  course.code = 'SOFTENG 789'; course.name = 'SOFTENG 789';
  course.teachers = ['Classroom-only instructor', 'Unassigned Teacher'];
  course.term = 'CLASSROOM-ONLY-TERM'; course.enrolmentStatus = 'WITHDRAWN';
  const html = render(report);
  assert(html.includes('<h3>SOFTENG 789</h3>'));
  for (const text of ['Classroom-only instructor', 'Unassigned Teacher', 'CLASSROOM-ONLY-TERM', 'withdrawn', 'Teachers:', 'SOFTENG 789 · SOFTENG 789', 'Completed lessons', 'Weekly participation']) assert(!html.includes(text), text);
  assert(html.includes('Only this student'));
  assert(html.includes('<dt>Lessons attended</dt><dd>4</dd>'));
  assert(html.includes('<dt>Absences</dt><dd>2</dd>'));
  assert(html.includes('<dt>Attendance rate</dt><dd>67%</dd>'));
});
test('confirmed achievement section is preserved and user-authored text stays escaped', () => {
  const report = exampleReport(); report.document.sections.push({ ...report.document.sections[0], topic: 'ACHIEVEMENTS', title: 'Achievements', text: 'Award for <script>alert(1)</script>' });
  const html = render(report);
  assert(html.includes('<h2>Achievements</h2>')); assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
});
test('report labels the saved snapshot time and never substitutes the original draft date', () => {
  const report = exampleReport();
  report.createdAt = '2026-08-12T00:00:00Z';
  report.document.snapshot.preparedAt = '2026-10-12T02:30:00Z';
  const html = render(report);
  assert(html.includes('<dt>Data as of</dt>'));
  assert(html.includes('12 Oct 2026')); assert(html.includes('NZDT'));
  assert(!html.includes('<dt>Prepared</dt>'));
  delete report.document.snapshot.preparedAt;
  const legacy = render(report);
  assert(legacy.includes('<dt>Draft created</dt>'));
  assert(!legacy.includes('<dt>Data as of</dt>'));
});
test('personal source appendix preserves exact lessons, feedback and eligible achievements with completeness separate', () => {
  const report = exampleReportWithSources(), html = render(report);
  for (const text of ['Recording completeness: 75%', '6 of 8 expected marks recorded', 'Lesson-by-lesson attendance',
    '8 applicable past completed lessons', '17 Aug 2026', '8 Sept 2026', 'Not recorded',
    'Ask the teaching team to check', 'Teacher feedback sources', 'Showing 2 of 2 recorded notes',
    'Teacher source: clear explanations', 'not AI-generated text', 'Recorded achievement details',
    'Confirmed project milestone', 'data-label="Recorded points">0</td>', 'correction requests await review: 1']) assert(html.includes(text), text);
  assert(!html.includes('Second Student')); assert(!html.includes('Class attendance'));
  assert.equal((html.match(/<th scope="row">\d/g) || []).length, 8);
});
test('source appendix has explicit legacy and empty states and escapes author text', () => {
  const legacy = render(exampleReport()); assert(legacy.includes('no detailed source snapshot'));
  const report = exampleReportWithSources(), sources = report.document.snapshot.sources;
  sources.feedback[0].excerpt = 'Source <script>alert(1)</script>';
  assert(render(report).includes('Source &lt;script&gt;')); assert(!render(report).includes('<script>'));
  sources.lessons = []; sources.feedback = []; sources.achievements = []; sources.pendingCorrections = 0;
  report.document.snapshot.feedbackCount = 0;
  const empty = render(report);
  assert(empty.includes('No applicable past completed lessons')); assert(empty.includes('No feedback source notes'));
  assert(!empty.includes('Recorded achievement details')); assert(!empty.includes('no detailed source snapshot'));
});
