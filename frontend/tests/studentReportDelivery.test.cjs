const test = require('node:test');
const assert = require('node:assert/strict');
const { deliverReportRevision } = require(process.env.STUDENT_REPORT_DELIVERY_PATH);
const { exampleReport } = require('./studentReportFixtures.cjs');

test('publish then email uses the returned revision, not the old preview revision', async () => {
  const report = exampleReport(); report.publishedAt = null;
  const events = [];
  const result = await deliverReportRevision(report, { publish: true, email: true }, {
    publish: async current => { events.push(['publish', current.version]); return { ...current, version: current.version + 1, publishedAt: '2026-10-12T00:00:00Z' }; },
    email: async current => { events.push(['email', current.version]); return { status: 'DEMO', message: 'Test only' }; }
  }, { published: current => events.push(['retained', current.version]), emailed: result => events.push([result.status]) });
  assert.equal(result.version, report.version + 1);
  assert.deepEqual(events, [['publish', report.version], ['retained', report.version + 1], ['email', report.version + 1], ['DEMO']]);
  assert.equal(report.publishedAt, null);
});

test('an interrupted email response keeps publication and retries the same email revision', async () => {
  let current = exampleReport(); current.publishedAt = null;
  let publishes = 0; const versions = [];
  const api = {
    publish: async report => { publishes++; return { ...report, version: report.version + 1, publishedAt: '2026-10-12T00:00:00Z' }; },
    email: async report => { versions.push(report.version); if (versions.length === 1) throw new TypeError('Response lost'); return { status: 'SENT', message: 'Prior receipt' }; }
  };
  const progress = { published: report => { current = report; }, emailed: () => {} };
  await assert.rejects(deliverReportRevision(current, { publish: true, email: true }, api, progress), /Response lost/);
  await deliverReportRevision(current, { publish: true, email: true }, api, progress);
  assert.equal(publishes, 1); assert.deepEqual(versions, [current.version, current.version]);
});

test('unconfirmed email outcomes are surfaced and a publication failure stops email', async () => {
  const report = exampleReport(); report.publishedAt = null;
  let emailCalls = 0; let result;
  const api = { publish: async () => { throw new Error('Version conflict'); }, email: async () => { emailCalls++; return { status: 'UNKNOWN', message: 'Check with recipient' }; } };
  const progress = { published: () => {}, emailed: outcome => { result = outcome; } };
  await assert.rejects(deliverReportRevision(report, { publish: true, email: true }, api, progress), /Version conflict/);
  assert.equal(emailCalls, 0);
  await deliverReportRevision(report, { publish: false, email: true }, api, progress);
  assert.equal(result.status, 'UNKNOWN');
  await deliverReportRevision(report, { publish: false, email: false }, api, progress);
  assert.equal(emailCalls, 1);
});
