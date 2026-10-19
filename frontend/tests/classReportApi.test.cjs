const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const bundled = buildSync({ entryPoints: [path.join(__dirname, '../src/features/class-reports/api.ts')], bundle: true, platform: 'node', format: 'cjs', write: false, define: { 'import.meta.env': '{}' } });
const compiled = new Module(__filename, module); compiled._compile(bundled.outputFiles[0].text, __filename);
const { classReportReviewApi: api, finalizeClassReport, listClassReports } = compiled.exports;

test('class generation, manual re-review and finalization bind the current preview version', async () => {
  const original = global.fetch, calls = [];
  global.fetch = async (url, init = {}) => { if(url==='/api/auth/csrf') return Response.json({headerName:'X-CSRF-TOKEN',token:'test-csrf'}); calls.push([url, init.method || 'GET', init.body && JSON.parse(init.body)]); return Response.json({}); };
  try {
    const scope = { courseOfferingId: 'course-1', dateFrom: '2026-10-01', dateTo: '2026-10-13' };
    const report = { id: 'class-report-1', version: 7, courseOfferingId: 'course-1', document: scope };
    assert(api.scopeValid(scope)); assert(!api.scopeChanged(scope, report));
    assert(!api.scopeValid({ ...scope, dateTo: '2026-09-01' }));
    assert(api.scopeChanged({ ...scope, courseOfferingId: 'course-2' }, report));
    await api.prepare(scope); await api.generate(report, 'LEARNING');
    await api.save(report, 'ATTENDANCE', 'Corrected wording', true, true);
    await finalizeClassReport(report); await listClassReports(scope.courseOfferingId);
    assert(calls[0][0].endsWith('/class-reports/prepare'));
    assert.deepEqual(calls[1].slice(1), ['POST', { version: 7 }]);
    assert.deepEqual(calls[2].slice(1), ['PUT', { version: 7, text: 'Corrected wording', approve: true, evidenceReviewed: true }]);
    assert.deepEqual(calls[3].slice(1), ['POST', { version: 7 }]);
    assert(calls[4][0].endsWith('/class-reports/history/course-1'));
  } finally { global.fetch = original; }
});
