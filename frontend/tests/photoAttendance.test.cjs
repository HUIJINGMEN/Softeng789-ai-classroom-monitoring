const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDecisions } = require(process.env.PHOTO_ATTENDANCE_MODEL_PATH);
const review = { result: { roster: [{ studentId: 'a' }, { studentId: 'b' }], recognition: { faces: [{ faceId: 'f1' }, { faceId: 'f2' }] } } };
test('no suggested identity is accepted without explicit review', () => {
  assert.throws(() => buildDecisions(review, {}, {}), /Review every face/);
});
test('duplicates and students outside the consenting roster are rejected', () => {
  assert.throws(() => buildDecisions(review, { f1: 'a', f2: 'a' }, {}), /only be selected once/);
  assert.throws(() => buildDecisions(review, { f1: 'outside', f2: 'EXCLUDE' }, {}), /no longer eligible/);
});
test('unknown exclusions never create absence and late requires an explicit choice', () => {
  assert.deepEqual(buildDecisions(review, { f1: 'a', f2: 'EXCLUDE' }, { f1: true }), [
    { faceId: 'f1', studentId: 'a', status: 'LATE' }, { faceId: 'f2', studentId: null, status: 'EXCLUDE' }
  ]);
  assert.equal(buildDecisions(review, { f1: 'a', f2: 'b' }, {})[0].status, 'PRESENT');
});
