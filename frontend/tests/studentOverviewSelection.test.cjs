const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { buildSync } = require('esbuild');
const root = path.join(__dirname, '..');
const code = buildSync({
  stdin: { contents: `export * from './src/features/student-overview/StudentOverviewRegister';
    export {default as Heading} from './src/features/payments/components/LessonPanelHeading';
    export {renderToStaticMarkup} from 'react-dom/server'; export {createElement} from 'react';`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: {'import.meta.env': '{}'}, loader: {'.css': 'empty'},
  external: ['react', 'react/jsx-runtime', 'react-dom/server']
}).outputFiles[0].text;
const loaded = new Module(__filename, module); loaded.paths = module.paths; loaded._compile(code, __filename);
const api = loaded.exports;
const session = (offering, hour) => ({id: 'same-session-id', courseOfferingId: offering, courseCode: offering,
  academicTerm: '2026 Teaching Year', date: '2026-10-07', startTime: hour === '10' ? '2026-10-06T21:00:00Z' : '2026-10-07T01:00:00Z',
  endTime: hour === '10' ? '2026-10-06T22:00:00Z' : '2026-10-07T02:00:00Z', room: 'Science Centre 303-G14', campus: 'City', status: 'COMPLETED'});
const sessions = [session('INFOSYS 222', '10'), session('COMPSCI 335', '14')];
const rows = ['Maia Rangi', 'Ana Ngata'].map((name, i) => {
  const account = {studentId: `student-${i}`, studentName: name, studentNumber: `DEMO-${i}`, courses: ['INFOSYS 222', 'COMPSCI 335'], state: 'PAID', balance: 0, paymentReported: 0, invoiceCount: 0, currency: 'NZD'};
  return {account, attended: 0, absent: 0, notRecorded: 2, needsAttention: true,
    cells: sessions.map(s => ({kind: 'LESSON', session: s, reconciliationRow: {...account},
      reconciliationCell: {sessionId: s.id, attendanceStatus: 'UNKNOWN', creditStatus: null, uncoveredAttendance: false}}))};
});
const target = rows[1].cells[1];
const selection = {row: target.reconciliationRow, cell: target.reconciliationCell, session: target.session, paymentAccount: rows[1].account};
function elements(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return elements(node.type(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => elements(child, predicate))];
}
const render = node => api.renderToStaticMarkup(node);
for (const [name, View] of [['table', api.StudentOverviewTable], ['mobile', api.StudentOverviewMobileList]]) {
  test(`${name} selects exactly one student/offering/session and clears selection on close`, () => {
    let opened;
    const props = {rows, sessions, showCourse: true, selection, onOpenStudent(){}, onOpenPayment(){}, onOpenLesson(value){opened=value;}};
    const tree = View(props);
    const cells = elements(tree, node => node.props?.['aria-haspopup'] === 'dialog');
    assert.equal(cells.length, 4);
    assert.equal(cells.filter(cell => cell.props['aria-current'] === 'true').length, 1);
    const selected = cells.find(cell => cell.props['aria-current'] === 'true');
    assert(selected.props['aria-label'].includes('Ana Ngata, COMPSCI 335'));
    assert(selected.props['aria-label'].includes('14:00–15:00'));
    assert.equal(selected.props['aria-expanded'], true);
    selected.props.onClick(); assert.equal(opened.session, sessions[1]); assert.equal(opened.row.studentId, 'student-1');
    assert(render(tree).includes('<span class="sr-only">Currently viewing this lesson</span>'));
    assert(!render(tree).includes('student-overview-cell-selected'));
    const closed = View({...props, selection: null});
    assert.equal(elements(closed, node => node.props?.['aria-current'] === 'true').length, 0);
    assert(!render(closed).includes('is-current-lesson'));
    if (name === 'table') {
      const html = render(tree);
      assert.equal((html.match(/class="is-current-lesson-column"/g) || []).length, 1);
      assert.equal((html.match(/is-current-lesson-student/g) || []).length, 1);
    }
  });
}
test('persistent heading identifies student, course, date, clock range and location without inventing absent fields', () => {
  const html = render(api.createElement(api.Heading, {row: selection.row, session: sessions[1], courseCode: 'COMPSCI 335', academicTerm: '2026 Teaching Year'}));
  for (const text of ['Ana Ngata', 'DEMO-1', 'COMPSCI 335', '2026 Teaching Year', '7 Oct 2026', '14:00–15:00', 'Science Centre 303-G14 · City']) assert(html.includes(text), text);
  const empty = render(api.createElement(api.Heading, {row: selection.row, session: {...sessions[0], room: '', campus: null}}));
  assert(empty.includes('Location not recorded')); assert(!empty.includes('undefined')); assert(!empty.includes('COMPSCI'));
});

test('selection uses a single neutral border without a floating badge or changing cell dimensions', () => {
  const css = readFileSync(path.join(root, 'src/styles/student-overview.css'), 'utf8');
  const rule = css.match(/\.student-overview \.lesson-cell\.is-current-lesson \{([^}]+)\}/)[1];
  assert(rule.includes('border-color: var(--text)'));assert(rule.includes('outline-offset: -1px'));
  assert(!/padding|height|width|box-shadow|background/.test(rule));
  assert(css.includes('.lesson-cell.is-current-lesson:focus-visible'));
  assert(!css.includes('.student-overview-cell-selected'));
});

test('wide-screen source cell stays above the backdrop without becoming interactive over the modal', () => {
  const css = readFileSync(path.join(root, 'src/styles/student-overview.css'), 'utf8');
  const paymentsCss = readFileSync(path.join(root, 'src/styles/payments.css'), 'utf8');
  const selector = '.student-overview-table-wrap.is-reviewing-lesson .lesson-cell.is-current-lesson';
  const start = css.indexOf(selector);
  assert(css.slice(0, start).lastIndexOf('@media (min-width: 1180px)') > css.indexOf('.lesson-cell.is-current-lesson:focus-visible'));
  const rule = css.slice(start).match(/\{([^}]+)\}/)[1];
  assert(rule.includes('z-index: calc(var(--lesson-review-layer, 140) + 1)'));
  assert(rule.includes('pointer-events: none'));assert(!rule.includes('background'));
  assert(paymentsCss.includes('z-index: var(--lesson-review-layer, 140)'));
});

const visibilityCode = buildSync({entryPoints: [path.join(root, 'src/features/student-overview/useSelectedLessonVisibility.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react']}).outputFiles[0].text;
function visibilityHarness({scroll = 900, width = 650, x = 1500, pinned = 430, selected = true} = {}) {
  let cleanup, observerCallback, disconnected = false;
  const listeners = new Map();
  const region = {scrollLeft: scroll, scrollTop: 30,
    getBoundingClientRect: () => ({left: 0, right: width}),
    querySelector: selector => selector === '[aria-current="true"]' ? (selected ? {getBoundingClientRect: () => ({left: x - region.scrollLeft, right: x - region.scrollLeft + 154, width: 154})} : null) : {getBoundingClientRect: () => ({right: pinned})}};
  const ref = {current: region};
  const mod = {exports: {}};
  vm.runInNewContext(visibilityCode, {module: mod, exports: mod.exports,
    require: () => ({useRef: () => ref, useLayoutEffect: effect => {cleanup = effect();}}),
    ResizeObserver: class {constructor(callback){observerCallback = callback;} observe(){} disconnect(){disconnected = true;}},
    window: {addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)}});
  return {region, listeners, get disconnected(){return disconnected;},
    open(key = 'student:course:session', enabled = true){return mod.exports.default(key, enabled);},
    resize(value){width = value;observerCallback?.();}, close(){cleanup?.();}};
}
test('rightmost selected lesson is revealed before the drawer, retaining sticky columns and restoring position on close', () => {
  const h = visibilityHarness();h.open();
  assert.equal(h.region.scrollLeft, 1012);assert.equal(h.region.scrollTop, 30);
  h.resize(620);assert.equal(h.region.scrollLeft, 1042);
  h.close();assert.equal(h.region.scrollLeft, 900);assert.equal(h.listeners.size, 0);assert.equal(h.disconnected, true);
});
test('left-side selections never hide under pinned columns, and already visible selections do not move', () => {
  const left = visibilityHarness({scroll: 1000, x: 1100});left.open();assert.equal(left.region.scrollLeft, 662);
  const visible = visibilityHarness({scroll: 1000, x: 1450});visible.open();assert.equal(visible.region.scrollLeft, 1000);
});
test('mobile, closed, missing and too-narrow registers do not invent scrolling space', () => {
  for (const config of [{selected: false}, {width: 580}]) {const h = visibilityHarness(config);h.open();assert.equal(h.region.scrollLeft, 900);h.close();}
  for (const [key, enabled] of [[null, true], ['selected', false]]) {
    const h = visibilityHarness();h.open(key, enabled);assert.equal(h.region.scrollLeft, 900);assert.equal(h.listeners.size, 0);
  }
});
