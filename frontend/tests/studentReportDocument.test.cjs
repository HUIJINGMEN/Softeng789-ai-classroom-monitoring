const assert = require('node:assert/strict');
const test = require('node:test');
const model = require(process.env.STUDENT_REPORT_DOCUMENT_PATH);

test('learning labels become headings without changing approved prose', () => {
  assert.deepEqual(model.narrativeBlocks('LEARNING', 'Summary.\r\n\r\nStrengths\r\nGood work.\r\n\r\nNext steps\r\nKeep practising.'), [
    { heading: null, paragraphs: ['Summary.'] },
    { heading: 'Strengths', paragraphs: ['Good work.'] },
    { heading: 'Next steps', paragraphs: ['Keep practising.'] }
  ]);
});
test('free text, line breaks, and heading words inside sentences are preserved', () => {
  assert.deepEqual(model.narrativeBlocks('LEARNING', 'Your Strengths include testing.\nKeep this line.\n\nAnother paragraph.'), [
    { heading: null, paragraphs: ['Your Strengths include testing.\nKeep this line.', 'Another paragraph.'] }
  ]);
  assert.deepEqual(model.narrativeBlocks('PAYMENTS', 'Next steps\nCheck the receipt.'), [
    { heading: null, paragraphs: ['Next steps\nCheck the receipt.'] }
  ]);
  assert.deepEqual(model.narrativeBlocks('LEARNING', ''), []);
});
test('review attribution is unique and never fabricates a staff review', () => {
  assert.deepEqual(model.reportReviewers({ document: { sections: [
    { reviewed: true, stale: false, reviewedBy: 'Teacher A' },
    { reviewed: true, stale: false, reviewedBy: 'Teacher A' },
    { reviewed: false, stale: false, reviewedBy: 'Teacher B' },
    { reviewed: true, stale: true, reviewedBy: 'Teacher C' },
    { reviewed: true, stale: false, reviewedBy: null }
  ] } }), ['Teacher A']);
});
test('PDF filename uses the student and scope, stripping unsafe filename characters', () => {
  assert.equal(model.studentReportFilename({ studentName: 'Ana / Ngata?', document: { dateFrom: '2026-08-12', dateTo: '2026-10-12' } }),
    'Student report - Ana  Ngata - 2026-08-12 to 2026-10-12');
});

test('narrative identities follow content when paragraphs reorder, including duplicates', () => {
  const first = model.keyedNarrativeBlocks('ATTENDANCE', 'First.\n\nRepeated.\n\nRepeated.')[0];
  const second = model.keyedNarrativeBlocks('ATTENDANCE', 'Repeated.\n\nRepeated.\n\nFirst.')[0];
  assert.deepEqual(first.paragraphs.map(p => p.text), ['First.', 'Repeated.', 'Repeated.']);
  assert.equal(first.paragraphs[0].key, second.paragraphs[2].key);
  assert.equal(first.paragraphs[1].key, second.paragraphs[0].key);
  assert.notEqual(first.paragraphs[1].key, first.paragraphs[2].key);
});
