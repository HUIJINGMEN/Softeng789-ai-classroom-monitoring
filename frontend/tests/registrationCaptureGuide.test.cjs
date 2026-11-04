const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
function bundle(file) {
  return buildSync({ entryPoints: [path.join(__dirname, '../src', file)], bundle: true,
    write: false, platform: 'node', format: 'cjs', external: ['react'] }).outputFiles[0].text;
}
const model = { exports: {} };
vm.runInNewContext(bundle('lib/registrationCaptureGuide.ts'), { module: model, exports: model.exports });
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
    module, exports: module.exports, require: () => react, URL, document: doc, performance: { now: () => now },
    window: { setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; } }, clearTimeout: id => timers.delete(id),
    Worker: class { constructor() { worker = this; } postMessage() {} terminate() { this.terminated = true; } },
    createImageBitmap: async () => ({ close() {} })
  });
  return { doc, track, captures,
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
