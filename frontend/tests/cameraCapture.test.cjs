const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/hooks/useCameraCapture.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'] }).outputFiles[0].text;
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
function mediaStream() {
  const track = { stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track] };
}
function harness() {
  const state = [], effects = [], requests = [], draws = [];
  let cursor = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
    useRef(initial) { return state[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (changed(state[i]?.deps, deps)) state[i] = { fn, deps }; return state[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (changed(state[i]?.deps, deps)) { state[i]?.cleanup?.(); state[i] = { deps }; effects.push(() => { state[i].cleanup = fn(); }); } }
  };
  const video = { srcObject: null, readyState: 2, videoWidth: 1080, videoHeight: 1920, pause() {}, play: async () => {} };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args) }), toDataURL: () => 'data:image/jpeg;base64,test' };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, DOMException, Error,
    navigator: { mediaDevices: { getUserMedia: constraints => new Promise((resolve, reject) => requests.push({ constraints, resolve, reject })) } },
    require: name => { assert.equal(name, 'react'); return react; }
  });
  return { video, canvas, requests, draws,
    unmount() { state.forEach(value => value?.cleanup?.()); },
    render(facingMode = 'environment') {
      cursor = 0; const result = module.exports.useCameraCapture({ facingMode, maxWidth: 1920, maxHeight: 1440 });
      result.videoRef.current = video; result.canvasRef.current = canvas; effects.splice(0).forEach(fn => fn()); return result;
    }
  };
}
test('switching camera releases the old stream; a late permission response cannot reopen it', async () => {
  const h = harness(); h.render(); const first = mediaStream(); h.requests[0].resolve(first); await flush();
  h.render('user'); assert(first.track.stopped); assert.equal(h.requests[1].constraints.video.facingMode.ideal, 'user');
  h.unmount(); const late = mediaStream(); h.requests[1].resolve(late); await flush(); assert(late.track.stopped); assert.equal(h.video.srcObject, null);
});
test('a playback error stops the acquired camera and a fresh retry can recover', async () => {
  const h = harness(); h.video.play = async () => { throw new Error('Playback failed'); }; h.render();
  const failed = mediaStream(); h.requests[0].resolve(failed); await flush();
  assert(failed.track.stopped); assert.equal(h.render().stream, null); assert.match(h.render().error, /Playback failed/);
  h.video.play = async () => {}; const retry = h.render().startCamera(); const healthy = mediaStream(); h.requests[1].resolve(healthy); await retry;
  assert.equal(h.render().stream, healthy); h.unmount(); assert(healthy.track.stopped);
});
test('portrait capture preserves aspect ratio and blocks an unready preview', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(mediaStream()); await flush();
  assert.equal(h.render().captureFrame(), 'data:image/jpeg;base64,test');
  assert.equal(h.canvas.width, 810); assert.equal(h.canvas.height, 1440);
  assert.deepEqual(h.draws[0].slice(1), [0, 0, 1080, 1920, 0, 0, 810, 1440]);
  h.video.readyState = 0; assert.equal(h.render().captureFrame(), null); assert.match(h.render().error, /not ready/); h.unmount();
});
