const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const source = file => readFileSync(join(__dirname, '../src', file), 'utf8');
const css = source('styles/report-print-isolation.css');

test('report isolation hides all body siblings instead of assuming .app is a body child', () => {
  assert(css.includes('@media print'));
  assert(css.includes('> :not(.report-summary-print)'));
  assert(css.includes('> :not(.student-report-print)'));
  assert(css.includes('display: none !important'));
  assert(!css.includes('> .app'));
  assert(!source('styles/print.css').includes('body:has(> .report-summary-print) > .app'));
});

test('an open personal report takes precedence over an underlying overview or class portal', () => {
  assert(css.includes('body:has(> .report-summary-print):not(:has(> .student-report-print))'));
  assert(css.includes('body:has(> .student-report-print):not(:has(> .overall-report-print)) > :not(.student-report-print)'));
  assert(css.includes('overflow: visible !important'));
});

test('both print documents load the same isolation rules regardless of which route is opened first', () => {
  for (const file of ['components/ReportSummaryPrint.tsx', 'features/student-reports/StudentReportDocument.tsx', 'features/class-reports/ClassReportDocument.tsx', 'features/overall-reports/OverallReportDocument.tsx']) {
    assert(source(file).includes('styles/report-print-isolation.css'), file);
    assert(source(file).includes('document.body'), file);
  }
});

test('explicit class export hides overview and shell but yields to a personal report', () => {
  assert(css.includes('body:has(> .class-report-print):not(:has(> .student-report-print)):not(:has(> .overall-report-print)) > :not(.class-report-print)'));
  assert(css.includes(':not(:has(> .class-report-print)):not(:has(> .overall-report-print)) > :not(.report-summary-print)'));
  const print = source('features/report-review/report-print.css');
  assert(print.includes('page: classlens-class-report !important'));
  assert(print.includes('ClassLens | Class report | Staff only'));
});

test('explicit overall export isolates its portal even when an earlier report remains mounted', () => {
  assert(css.includes('body:has(> .overall-report-print) > :not(.overall-report-print)'));
  for (const portal of ['report-summary-print', 'student-report-print', 'class-report-print']) {
    assert(css.includes(':not(:has(> .overall-report-print)) > :not(.' + portal + ')'));
  }
});
