const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const path = require('node:path');
const Module = require('node:module');
const code = buildSync({entryPoints: [path.join(__dirname, '../src/lib/sessionTime.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs'}).outputFiles[0].text;
const loaded = new Module(__filename, module); loaded._compile(code, __filename);
const time = loaded.exports;

test('school date defaults and calendar months do not use UTC or overflow short months', () => {
  for (const host of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
    const previous = process.env.TZ;
    try {
      process.env.TZ = host;
      assert.equal(time.formatIsoDateInAuckland(new Date('2026-10-17T11:30:00Z')), '2026-10-18');
      assert.equal(time.schoolDateMonthsAgo(2, new Date('2026-10-17T11:30:00Z')), '2026-08-18');
      assert.equal(time.schoolDateMonthsAgo(1, new Date('2026-03-30T12:00:00Z')), '2026-02-28');
      assert.equal(time.schoolDateMonthsAgo(1, new Date('2024-03-30T12:00:00Z')), '2024-02-29');
      assert.equal(time.timestampInSchoolDateRange('2026-10-17T11:30:00Z', '2026-10-18', ''), true);
      assert.equal(time.timestampInSchoolDateRange('2026-10-17T10:59:59Z', '2026-10-18', ''), false);
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});

test('school clocks round-trip in winter, summer and across both DST boundaries regardless of host timezone', () => {
  const original = process.env.TZ;
  try {
    for (const host of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai', 'Pacific/Auckland']) {
      process.env.TZ = host;
      for (const [day, clock, expected] of [
        ['2026-07-14', '10:00', '2026-07-13T22:00:00.000Z'],
        ['2026-10-14', '10:00', '2026-10-13T21:00:00.000Z'],
        ['2026-10-14', '14:00', '2026-10-14T01:00:00.000Z'],
        ['2026-10-14', '23:00', '2026-10-14T10:00:00.000Z'],
        ['2026-10-14', '00:00', '2026-10-13T11:00:00.000Z'],
        ['2026-09-26', '10:00', '2026-09-25T22:00:00.000Z'],
        ['2026-09-27', '10:00', '2026-09-26T21:00:00.000Z'],
        ['2027-04-03', '10:00', '2027-04-02T21:00:00.000Z'],
        ['2027-04-04', '10:00', '2027-04-03T22:00:00.000Z']
      ]) {
        assert.equal(time.toSessionInstant(day, clock), expected, host);
        assert.equal(time.sessionStartClock(expected, day), clock, host);
        assert.equal(time.formatIsoDateInAuckland(new Date(expected)), day, host);
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test('rejects nonexistent and repeated local clocks rather than guessing an offset', () => {
  for (const day of ['2026-09-27', '2027-04-04']) {
    assert.throws(() => time.toSessionInstant(day, '02:30'), /daylight-saving/);
  }
  for (const [day, clock] of [['2026-02-30', '10:00'], ['2026-10-14', '25:00'], ['invalid', '10:00']]) {
    assert.throws(() => time.toSessionInstant(day, clock), /valid/);
  }
});

test('same UTC and school date is still a real instant, with no date-based encoding heuristic', () => {
  assert.deepEqual(time.sessionTimeFields('2026-10-14T01:00:00Z', '2026-10-14T04:00:00Z', '2026-10-14'),
    {startTime: '14:00', endTime: '17:00'});
  assert.equal(time.formatSessionTimeRange('2026-10-13T21:00:00Z', '2026-10-14T01:00:00Z', '2026-10-14'), '10:00–14:00');
  assert.equal(time.formatTimestampClock('invalid'), '—');
});
