const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const bundled = buildSync({
  entryPoints: [path.join(__dirname, '../src/features/student-reports/api.ts')],
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': '{}' }
});
const compiled = new Module(__filename, module);
compiled._compile(bundled.outputFiles[0].text, __filename);
const api = compiled.exports;

test('email binds the preview version and manual re-review is explicit in the API payload', async () => {
  const calls = []; const originalFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push([url, init.method, JSON.parse(init.body)]); return Response.json({ status: 'UNKNOWN', message: 'Check delivery' }); };
  try {
    const report = { id: 'report-1', version: 12 };
    assert.equal((await api.emailStudentReport(report)).status, 'UNKNOWN');
    await api.saveReportSection(report, 'ATTENDANCE', 'My correction', true, true);
    assert(calls[0][0].endsWith('/report-1/email'));
    assert.deepEqual(calls[0].slice(1), ['POST', { version: 12 }]);
    assert.deepEqual(calls[1].slice(1), ['PUT', { version: 12, text: 'My correction', approve: true, evidenceReviewed: true }]);
  } finally { global.fetch = originalFetch; }
});
test('workspace listing is read-only and batches at most 100 scopes without preparing reports', async () => {
  const originalFetch = global.fetch; const calls = [];
  global.fetch = async (url, init) => { calls.push([url, JSON.parse(init.body)]); return Response.json([]); };
  try {
    await api.listStudentReportProgress(Array.from({ length: 205 }, (_, i) => ({ studentId: String(i) })));
    assert.deepEqual(calls.map(c => c[1].scopes.length), [100, 100, 5]);
    assert(calls.every(c => c[0].endsWith('/student-reports/workspace')));
    assert.equal(await api.listStudentReportProgress([]).then(r => r.length), 0);
    assert.equal(calls.length, 3);
  } finally { global.fetch = originalFetch; }
});
