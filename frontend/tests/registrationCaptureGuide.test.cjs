const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
function bundle(file, extra = []) {
  return buildSync({ entryPoints: [path.join(__dirname, '../src', file)], bundle: true,
    write: false, platform: 'node', format: 'cjs', external: ['react', '../features/webcam-events', ...extra], loader: { '.css': 'empty' } }).outputFiles[0].text;
}
const geometry = { exports: {} };
vm.runInNewContext(bundle('features/webcam-events/observationModel.ts'), { module: geometry, exports: geometry.exports });
const model = { exports: {} };
vm.runInNewContext(bundle('lib/registrationCaptureGuide.ts'), { module: model, exports: model.exports, require: () => geometry.exports });
const { registrationGuideSample: sample, RegistrationCaptureHold: Hold } = model.exports;
function frame(yaw = 0, pitch = 0) {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  return { type: 'result', timestamp: 100, count: 1, inferenceMs: 10,
    boxes: [{ x: .35, y: .2, width: .3, height: .6 }],
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p), 0, 0, 0, 0, 1] };
}
test('all seven requested directions match only their own angle band', () => {
  const poses = [['front', 0, 0], ['slight_left', 17, 0], ['left', 30, 0],
    ['slight_right', -17, 0], ['right', -30, 0], ['chin_up', 0, -16], ['chin_down', 0, 16]];
  for (const [pose, yaw, pitch] of poses) {
    assert.equal(sample(frame(yaw, pitch), pose, 4 / 3, 0).ready, true, pose);
    for (const [other] of poses.filter(([name]) => name !== pose))
      assert.equal(sample(frame(yaw, pitch), other, 4 / 3, 0).ready, false, `${pose} cannot satisfy ${other}`);
  }
  assert.equal(sample(frame(0, 6), 'chin_up', 4 / 3, 22).ready, true, 'pitch is relative to frontal capture');
});
test('no face, multiple faces, off-centre, bad size, missing pose and malformed bounds never capture', () => {
  const invalid = [ { count: 0 }, { count: 2 }, { matrix: null }, { boxes: [] },
    { boxes: [{ x: 0, y: .2, width: .3, height: .6 }] },
    { boxes: [{ x: .45, y: .4, width: .1, height: .2 }] },
    { boxes: [{ x: .1, y: .1, width: .8, height: .8 }] },
    { boxes: [{ x: NaN, y: .2, width: .3, height: .6 }] } ];
  for (const change of invalid) assert.equal(sample({ ...frame(), ...change }, 'front', 4 / 3, 0).ready, false);
});
test('hold requires one second of fresh stable samples, resets for motion, gaps and loss', () => {
  const hold = new Hold(), good = sample(frame(), 'front', 4 / 3, 0);
  assert.equal(hold.update(good, 100), 0);
  for (let at = 300; at <= 1100; at += 200) assert.equal(hold.update(good, at), (at - 100) / 1000);
  assert.equal(hold.update(good, 1800), 0, 'stalled video cannot complete a hold');
  assert.equal(hold.update(sample(frame(6), 'front', 4 / 3, 0), 2000), 0, 'movement restarts hold');
  assert.equal(hold.update({ ...good, ready: false }, 2200), 0);
  assert.equal(hold.update(good, 2400), 0);
  assert.equal(hold.update(good, 2400), 0, 'duplicate frames reset');
});

function harness() {
  let now = 0, cursor = 0, worker, onVisibility;
  const state = [], effects = [], timers = new Map(), captures = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { return state[cursor++] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!state[i] || deps.some((v, n) => v !== state[i].deps[n])) {
      state[i]?.cleanup?.(); state[i] = { deps }; effects.push(() => { state[i].cleanup = fn(); });
    } }
  };
  const doc = { hidden: false, baseURI: 'http://localhost/', addEventListener(_, fn) { onVisibility = fn; }, removeEventListener() {} };
  const track = { readyState: 'live', muted: false };
  const stream = { getVideoTracks: () => [track] };
  const videoRef = { current: { readyState: 2, currentTime: 1, videoWidth: 640, videoHeight: 480 } };
  const module = { exports: {} };
  vm.runInNewContext(bundle('hooks/useRegistrationGuide.ts'), {
    module, exports: module.exports, require: name => name === 'react' ? react : geometry.exports, URL, document: doc, performance: { now: () => now },
    window: { setTimeout(fn, ms) { const id = Symbol(); timers.set(id, { fn, ms }); return id; } }, clearTimeout: id => timers.delete(id),
    Worker: class { constructor() { worker = this; } postMessage() {} terminate() { this.terminated = true; } },
    createImageBitmap: async () => ({ close() {} })
  });
  return { doc, track, captures,
    ready() { worker.onmessage({ data: { type: 'ready' } }); },
    show() { doc.hidden = false; onVisibility(); },
    timeout(at, ms = 5000) {
      now = at;
      const entry = [...timers].find(([, timer]) => timer.ms === ms);
      assert(entry, 'expected an armed watchdog'); timers.delete(entry[0]); entry[1].fn();
    },
    render(enabled = true, target = 'front', reset = '') { cursor = 0;
      const result = module.exports.useRegistrationGuide(videoRef, stream, target, enabled, () => captures.push(target), reset);
      effects.splice(0).forEach(fn => fn()); return result; },
    send(at, data = frame()) { now = at; worker.onmessage({ data: { ...data, timestamp: at } }); },
    stale(at) { now = at; worker.onmessage({ data: { ...frame(), timestamp: at - 600 } }); },
    hide() { doc.hidden = true; onVisibility(); },
    fail() { worker.onerror(); },
    unmount() { state.forEach(s => s?.cleanup?.()); return worker.terminated; }
  };
}
test('automatic hook fires once per hold, pauses, and requires a new hold for the next pose', () => {
  const h = harness(); h.render();
  for (let at = 100; at <= 1500; at += 200) h.send(at);
  assert.deepEqual(h.captures, ['front']);
  h.render(false);
  for (let at = 1700; at <= 2900; at += 200) h.send(at);
  assert.equal(h.captures.length, 1);
  h.render(true, 'slight_left');
  for (let at = 3100; at <= 4100; at += 200) h.send(at, frame(17));
  assert.deepEqual(h.captures, ['front', 'slight_left']);
  assert.equal(h.unmount(), true);
  h.send(4300, frame(17)); assert.equal(h.captures.length, 2);
});
test('hidden tabs, muted cameras, stale results and model failure cannot auto capture', () => {
  for (const interrupt of [h => h.hide(), h => { h.track.muted = true; }, h => h.fail()]) {
    const h = harness(); h.render(); h.send(100); h.send(300); h.send(500); interrupt(h);
    for (let at = 700; at <= 2100; at += 200) h.send(at);
    assert.equal(h.captures.length, 0); h.unmount();
  }
  const h = harness(); h.render(); h.send(100); h.send(300); h.send(500); h.stale(700);
  h.send(900); h.send(1100); assert.equal(h.captures.length, 0);
  h.fail(); assert.equal(h.render().available, false); h.unmount();
});


test('slow hidden frames and sleep keep guidance available; visible stalls still fail', async () => {
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const h = harness(); h.render(); h.ready(); await flush();
  h.hide(); h.timeout(5000);
  assert.equal(h.render().available, true); assert.equal(h.render().progress, 0);
  h.show(); h.stale(5200);
  for (let at = 5400; at <= 6400; at += 200) h.send(at);
  assert.deepEqual(h.captures, ['front'], 'fresh frames can complete a new hold'); h.unmount();
  const sleep = harness(); sleep.render(); sleep.ready(); await flush(); sleep.timeout(8000);
  assert.equal(sleep.render().available, true, 'late watchdog after sleep is not a failure');
  sleep.timeout(13000); assert.equal(sleep.render().available, false, 'a fresh visible stall does fail'); sleep.unmount();
  const visible = harness(); visible.render(); visible.ready(); await flush(); visible.timeout(5000);
  assert.equal(visible.render().available, false); visible.unmount();
});

test('manual front baseline uses the accepted shutter sample; reset and stale samples cannot restore it', () => {
  const h = harness(); h.render(false); h.send(100, frame(0, 18));
  const accept = h.render(false).prepareFrontCapture();
  h.send(200, frame(0, 0)); // Movement while the server checks must not change the snapshot.
  h.render(true, 'chin_up'); h.send(300, frame(0, 2));
  assert.match(h.render(true, 'chin_up').message, /front pose/);
  accept();
  for (let at = 500; at <= 1500; at += 200) h.send(at, frame(0, 2));
  assert.deepEqual(h.captures, ['chin_up'], '18 degree baseline makes 2 degrees an upward pose');
  h.render(false, 'front').resetFrontBaseline(); h.send(1700, frame(0, 10));
  const lateAccept = h.render(false).prepareFrontCapture();
  h.render(false).resetFrontBaseline(); lateAccept();
  h.render(true, 'chin_down'); h.send(1900, frame(0, 16));
  assert.match(h.render(true, 'chin_down').message, /front pose/);
  h.render(false, 'front'); h.send(2100, frame(0, 18)); h.stale(2800);
  h.render(false).prepareFrontCapture()(); h.render(true, 'chin_up'); h.send(3000, frame(0, 2));
  assert.match(h.render(true, 'chin_up').message, /front pose/); h.unmount();
});

test('automatic hold alone does not establish a baseline before server acceptance', () => {
  const h = harness(); h.render();
  for (let at = 100; at <= 1100; at += 200) h.send(at, frame(0, 18));
  assert.deepEqual(h.captures, ['front']);
  h.render(true, 'chin_down'); h.send(1300, frame(0, 16));
  assert.match(h.render(true, 'chin_down').message, /front pose/); h.unmount();
});

function cameraHarness() {
  const state = [], effects = [], timers = [];
  let cursor = 0, tree, resolveCheck, prepareCount = 0, acceptCount = 0, resetCount = 0;
  const react = { ...require('react'),
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => state[i] = typeof value === 'function' ? value(state[i]) : value]; },
    useRef(initial) { return state[cursor++] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!state[i] || deps.some((v, n) => v !== state[i].deps[n])) {
      state[i]?.cleanup?.(); state[i] = { deps }; effects.push(() => state[i].cleanup = fn());
    } }
  };
  const guide = { available: true, progress: 0, message: '',
    prepareFrontCapture() { prepareCount++; return () => { acceptCount++; }; },
    resetFrontBaseline() { resetCount++; } };
  const props = { captures: [], busy: false, retakeIndex: null, noticeVersion: 'test',
    onChange(next) { props.captures = next; }, onRetakeChange(index) { props.retakeIndex = index; } };
  const module = { exports: {} };
  const code = bundle('components/auth/RegistrationCamera.tsx', ['../../hooks/useCameraCapture', '../../hooks/useCaptureValidation', '../../hooks/useRegistrationGuide', '../../hooks/useCaptureSound', 'react/jsx-runtime']);
  vm.runInNewContext(code, { module, exports: module.exports, document: { hidden: false },
    window: { setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name.endsWith('/useCameraCapture')) return { useCameraCapture: () => ({ videoRef: {}, canvasRef: {}, stream: {}, captureFrame: () => 'test-image', stopCamera() {}, startCamera() {} }) };
      if (name.endsWith('/useCaptureValidation')) return { useCaptureValidation: () => ({ checking: false, check: () => new Promise(resolve => resolveCheck = resolve), clear() {}, cancel() {} }) };
      if (name.endsWith('/useRegistrationGuide')) return { useRegistrationGuide: () => guide };
      if (name.endsWith('/useCaptureSound')) return { useCaptureSound: () => ({ unlock() {}, play() {} }) };
      throw new Error(name);
    }
  });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'number') return String(node); return typeof node === 'string' ? node : [node?.props?.children].flat(Infinity).map(c => typeof c === 'string' ? c : text(c)).join(''); }
  return { guide, props,
    render() { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => fn()); return text(tree); },
    button(label) { const node = nodes(tree).find(n => n.type === 'button' && text(n) === label); assert(node, label); return node; },
    resolve(value) { resolveCheck(value); }, finishSuccess() { timers.splice(0).forEach(fn => fn()); },
    counts: () => ({ prepareCount, acceptCount, resetCount })
  };
}

test('camera turns auto off on guidance failure, including after guidance recovers', () => {
  const h = cameraHarness(); h.render(); h.button('Start auto capture').props.onClick();
  assert.match(h.render(), /Auto capture on/);
  h.guide.available = false; h.render();
  assert.doesNotMatch(h.render(), /Auto capture on|Pause auto capture/);
  assert.equal(h.button('Start auto capture').props.disabled, true);
  h.guide.available = true; assert.doesNotMatch(h.render(), /Auto capture on|Pause auto capture/);
});

test('camera commits manual baseline only on acceptance and resets it for front retake and Retake all', async () => {
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const h = cameraHarness(); h.render(); h.button('Capture pose manually').props.onClick();
  assert.deepEqual(h.counts(), { prepareCount: 1, acceptCount: 0, resetCount: 0 });
  h.resolve(false); await flush(); h.render();
  h.button('Capture pose manually').props.onClick(); h.resolve(true); await flush();
  assert.equal(h.counts().acceptCount, 1);
  h.finishSuccess(); h.render(); h.button('Retake 1').props.onClick();
  assert.equal(h.counts().resetCount, 1);
  h.render(); h.button('Retake all').props.onClick();
  assert.equal(h.counts().resetCount, 2); assert.equal(h.props.captures.length, 0);
});
