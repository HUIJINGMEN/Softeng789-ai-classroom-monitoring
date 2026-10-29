const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const postcss = require('postcss');
const root = path.join(__dirname, '../src');

function bundle(relative, external = []) {
  return buildSync({ entryPoints: [path.join(root, relative)], bundle: true, write: false,
    platform: 'node', format: 'cjs', external, define: { 'import.meta.env': '{}' } }).outputFiles[0].text;
}
function load(relative) {
  const module = { exports: {} };
  vm.runInNewContext(bundle(relative, ['react', 'react/jsx-runtime']), { module, exports: module.exports, require });
  return module.exports;
}

test('email screening is bounded and rejects malformed identities without backtracking', () => {
  const { isEmailAddress } = load('lib/emailAddress.ts');
  for (const value of ['student+class@example.ac.nz', '学生@example.nz', 'a@b.nz']) assert(isEmailAddress(value));
  for (const value of ['', '@example.nz', 'a@@example.nz', 'a@.nz', 'a@nz.', 'a b@example.nz', 'x'.repeat(1000000)])
    assert.equal(isEmailAddress(value), false, value.slice(0, 30));
});

test('camera guidance preserves error, waiting, quality and success precedence', () => {
  const { captureGuidanceStatus: label } = load('components/cameraCaptureState.ts');
  assert.equal(label('blocked', true, 'success', 'Prompt'), 'Camera issue');
  assert.equal(label('', true, 'error', 'Prompt'), 'Hold still');
  assert.equal(label('', false, 'checking'), 'Hold still');
  assert.equal(label('', false, 'error'), 'Try again');
  assert.equal(label('', false, 'success', 'Prompt'), 'Face detected');
  assert.equal(label('', false, 'idle', 'Prompt'), 'Prompt');
});

test('all delivery combinations retain distinct action labels and honest demo outcomes', () => {
  const { deliveryActionLabel: label, deliveryCompletionMessage: message } = load('features/report-review/reportDeliverySelection.ts');
  assert.equal(label(false, false, false), 'Choose delivery');
  assert.equal(label(true, false, false), 'Download report');
  assert.equal(label(false, true, false), 'Email report');
  assert.equal(label(false, false, true), 'Publish report');
  assert.equal(label(true, true, false), 'Deliver report · 2 actions');
  assert.equal(label(true, true, true), 'Deliver report · 3 actions');
  assert.match(message([{ status: 'DEMO' }], true), /no external email was sent/);
  assert.match(message([{ status: 'DEMO' }, { status: 'SENT' }], true), /not resent/);
  assert.equal(message([], false), '');
});

test('avatar tones handle short IDs and Unicode while preserving existing ASCII palettes', () => {
  const { avatarTone, courseTone } = load('lib/format.ts');
  assert.equal(avatarTone('student-1', 0), 'person__avatar--green');
  assert.equal(avatarTone('', 0), 'person__avatar--blue');
  assert.equal(typeof avatarTone('学生', 1), 'string');
  assert.equal(typeof courseTone('课程😀'), 'string');
});

test('navigation badges preserve administrator totals and teacher-selected-session scope', () => {
  const { buildConsoleNavigation } = load('features/console-shell/consoleNavigation.tsx');
  const state = { students: [{}, {}], events: [{ status: 'Pending Review', sessionId: 'a' }, { status: 'Pending Review', sessionId: 'b' }],
    sessions: [{ date: '2026-10-27', status: 'Cancelled' }, { date: '2026-10-27', status: 'Live' }, { date: '2026-10-28', status: 'Scheduled' }],
    sessionId: 'a', counts: { total: 5 }, pendingAccomplishmentReviewCount: 2, awaitingReviewCount: 3, monitor: 'stopped' };
  const admin = buildConsoleNavigation(state, true, '2026-10-27');
  const teacher = buildConsoleNavigation(state, false, '2026-10-27');
  assert.equal(admin.find(x => x.page === 'attendance').count, '1');
  assert.equal(teacher.find(x => x.page === 'attendance').count, '5');
  assert.equal(admin.find(x => x.page === 'events').count, '2');
  assert.equal(teacher.find(x => x.page === 'events').count, '1');
  assert(admin.some(x => x.page === 'payments'));
  assert(!teacher.some(x => x.page === 'payments'));
});

test('shell refactoring retains teacher/admin classes and report-layout boundaries', () => {
  const { consoleAppClassName: classes } = load('features/console-shell/consoleShellModel.ts');
  for (const isAdmin of [false, true]) for (const page of ['dashboard', 'reports']) for (const level of ['overview', 'classes', 'students']) {
    const actual = classes(page, isAdmin, level).split(' ');
    assert(actual.includes(isAdmin ? 'app--admin' : 'app--teacher'));
    assert.equal(actual.includes('app--report-workspace'), page === 'reports' && (level === 'students' || (isAdmin && level === 'overview')));
  }
});

function achievementHarness({ students, initialStudentIds = [], save = async () => {} }) {
  const values = [], saved = [], toasts = [];
  let cursor = 0, closed = 0, refreshed = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
    useMemo: compute => compute()
  };
  const module = { exports: {} };
  const apiPath = '../../lib/accomplishmentApi';
  vm.runInNewContext(bundle('features/accomplishment-entry/useAchievementEntry.ts', ['react', apiPath]), {
    module, exports: module.exports, require: id => {
      if (id === 'react') return react;
      if (id === apiPath) return { createAccomplishments: async payload => { saved.push(payload); await save(); } };
      return require(id);
    }
  });
  const props = { students, initialStudentIds,
    courseOptions: [{ id: 'class-a', label: 'Class A', studentIds: ['a'] }, { id: 'class-b', label: 'Class B', studentIds: ['b'] }],
    onClose() { closed++; }, onCreated() { refreshed++; }, showToast: text => toasts.push(text) };
  return { saved, toasts, get closed() { return closed; }, get refreshed() { return refreshed; },
    render() { cursor = 0; return module.exports.useAchievementEntry(props); } };
}
const students = [
  { id: 'student-a', recordId: 'a', name: 'Ana', studentNumber: 'A' },
  { id: 'student-b', recordId: 'b', name: 'Noah', studentNumber: 'B' }
];

test('achievement flow preserves class scope, optional points and separate draft/share actions', async () => {
  const h = achievementHarness({ students });
  h.render().setTitle('  Completed project  ');
  h.render().toggleStudent('a');
  h.render().updateEntry('a', { points: '0', note: '  Good work  ' });
  await h.render().save(false);
  assert.equal(h.saved[0].confirm, false);
  assert.equal(h.saved[0].title, 'Completed project');
  assert.equal(h.saved[0].entries[0].points, 0);
  assert.equal(h.saved[0].entries[0].note, 'Good work');
  assert.equal(h.closed, 1); assert.equal(h.refreshed, 1);
  h.render().selectCourse('class-b');
  assert.equal(h.render().entries.length, 0);
  assert.equal(h.render().filteredStudents[0].recordId, 'b');
  h.render().toggleStudent('b');
  await h.render().save(true);
  assert.equal(h.saved[1].confirm, true);
  assert.equal(h.saved[1].entries[0].points, null);
});

test('achievement errors preserve entered details and never announce a successful save', async () => {
  const h = achievementHarness({ students, save: async () => { throw new Error('Offline'); } });
  h.render().setTitle('Keep this title');
  await h.render().save(false);
  assert.equal(h.saved.length, 0);
  assert.match(h.render().error, /Select at least one/);
  h.render().toggleStudent('a');
  h.render().updateEntry('a', { points: '-1' });
  await h.render().save(false);
  assert.equal(h.saved.length, 0);
  h.render().updateEntry('a', { points: '2.5' });
  await h.render().save(false);
  assert.equal(h.render().title, 'Keep this title');
  assert.equal(h.render().entries[0].points, '2.5');
  assert.equal(h.render().saving, false);
  assert.equal(h.closed, 0); assert.equal(h.toasts.length, 0);
});

test('fixed-recipient achievement flow does not introduce an extra recipient step', () => {
  const h = achievementHarness({ students: students.slice(0, 1), initialStudentIds: ['a'] });
  assert.equal(h.render().fixedRecipient, true);
  assert.equal(h.render().entries.length, 1);
  const entry = h.render();
  assert.equal(entry.handleSubmit, entry.submitFixedRecipient);
});

test('historical schema fails closed before any destructive statements, inside one transaction', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
  assert(schema.indexOf('BEGIN;') < schema.indexOf('RAISE EXCEPTION'));
  assert(schema.indexOf('RAISE EXCEPTION') < schema.indexOf('DELETE FROM'));
  assert(schema.trimEnd().endsWith('COMMIT;'));
});

function colour(value, background = [255, 255, 255]) {
  if (value.startsWith('#')) return value.slice(1).match(/../g).map(x => Number.parseInt(x, 16));
  const parts = value.match(/[\d.]+/g).map(Number);
  return parts.slice(0, 3).map((channel, i) => channel * parts[3] + background[i] * (1 - parts[3]));
}
function luminance(channels) {
  const linear = channels.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}
test('secondary theme text remains readable on all three panel surfaces in light and dark themes', () => {
  const css = postcss.parse(fs.readFileSync(path.join(root, 'styles/theme.css'), 'utf8'));
  for (const selector of [':root', "body[data-theme='dark']"]) {
    const rule = css.nodes.find(node => node.type === 'rule' && node.selector === selector);
    const vars = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]));
    for (const foreground of ['--muted', '--muted-2']) {
      for (const surface of ['--panel', '--panel-2', '--panel-3']) {
        const bg = colour(vars[surface]);
        const ratio = contrast(colour(vars[foreground], bg), bg);
        assert(ratio >= 4.5, `${selector} ${foreground} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  }
});
test('landing video cannot wash out supporting copy even on an entirely white frame', () => {
  const css = postcss.parse(fs.readFileSync(path.join(root, 'styles/landing.css'), 'utf8'));
  const scrim = css.nodes.find(n => n.type === 'rule' && n.selector === '.landing__scrim');
  const backdrop = scrim.nodes.find(n => n.prop === 'background').value;
  const stops = [...backdrop.matchAll(/rgba\(6, 6, 5, ([\d.]+)\)/g)].map(match => Number(match[1]));
  assert.equal(stops.length, 3);
  const bg = colour(`rgba(6, 6, 5, ${Math.min(...stops)})`);
  const copy = css.nodes.find(n => n.type === 'rule' && n.selector === '.landing__copy').nodes.find(n => n.prop === 'color').value;
  assert(contrast(colour(copy, bg), bg) >= 4.5);
});

test('auth supporting copy and placeholders remain readable on the brightest video scrim', () => {
  const css = postcss.parse(fs.readFileSync(path.join(root, 'styles/auth.css'), 'utf8'));
  const background = colour('rgba(6, 6, 5, 0.72)');
  let checked = 0;
  css.walkDecls('color', declaration => {
    if (!declaration.value.startsWith('rgba(')) return;
    checked++;
    assert(contrast(colour(declaration.value, background), background) >= 4.5,
      `${declaration.parent.selector}: ${declaration.value}`);
  });
  assert(checked >= 20);
});

test('new feature views use their controller, not duplicate API or state ownership', () => {
  const feature = path.join(root, 'features/accomplishment-entry');
  for (const name of ['AchievementDetails.tsx', 'AchievementRecipients.tsx', 'AchievementEntryFooter.tsx']) {
    const source = fs.readFileSync(path.join(feature, name), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(?:Api|apiClient|useState|useEffect)/);
    assert.doesNotMatch(source, /\b(?:fetch|createAccomplishments)\s*\(/);
  }
  const wrapper = fs.readFileSync(path.join(root, 'components/CreateAccomplishmentModal.tsx'), 'utf8');
  assert.match(wrapper, /export \{.*default.*\} from/);
  assert.doesNotMatch(wrapper, /\buseState\b|\bfetch\s*\(/);
});
