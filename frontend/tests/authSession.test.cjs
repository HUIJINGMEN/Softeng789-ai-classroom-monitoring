const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({entryPoints: [path.join(__dirname, '../src/hooks/useAuth.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs', external: ['react', '../lib/authApi', '../lib/apiClient']}).outputFiles[0].text;
const user = token => ({token, role: 'admin', id: token, name: token, email: token + '@example.test'});
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const values = [], effects = [], pending = [], requests = [], listeners = new Map();
  const storage = new Map([['classroomiq.auth', JSON.stringify(user('old'))]]);
  let cursor = 0, token;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return values[i] ??= {current: initial}; },
    useCallback(callback, deps) { const i = cursor++;
      if (!values[i] || deps.some((value, n) => !Object.is(value, values[i].deps[n]))) values[i] = {deps, callback};
      return values[i].callback; },
    useEffect(callback, deps) { const i = cursor++, old = effects[i];
      if (!old || deps.some((value, n) => !Object.is(value, old.deps[n]))) pending.push(() => {
        old?.cleanup?.(); effects[i] = {deps, cleanup: callback()};
      }); }
  };
  class ApiError extends Error { constructor() { super('Expired'); this.status = 401; } }
  const api = Object.fromEntries(['fetchCurrentUser', 'login', 'logout', 'registerStudent', 'registerTeacher']
    .map(name => [name, () => new Promise((resolve, reject) => requests.push({name, resolve, reject}))]));
  const browser = {localStorage: {getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)};
  const module = {exports: {}};
  vm.runInNewContext(code, {module, exports: module.exports, window: browser, require(name) {
    if (name === 'react') return react;
    if (name === '../lib/authApi') return api;
    if (name === '../lib/apiClient') return {ApiError, apiMessage: error => error.message, setAuthToken: value => { token = value; }, setUnauthorizedHandler() {}};
    throw new Error(name);
  }});
  return {requests, ApiError, get token() {return token;},
    render() {cursor = 0; const result = module.exports.useAuth(); pending.splice(0).forEach(fn => fn()); return result;},
    otherTab(next) {
      if (next) storage.set('classroomiq.auth', JSON.stringify(next)); else storage.delete('classroomiq.auth');
      listeners.get('storage')({key: 'classroomiq.auth', storageArea: browser.localStorage});
    }};
}

for (const outcome of ['success', '401']) {
  test(`late restoration ${outcome} cannot overwrite or clear a newly logged-in session`, async () => {
    const h = harness(); h.render();
    const login = h.render().login({}); h.requests[1].resolve(user('new')); await login;
    if (outcome === 'success') h.requests[0].resolve(user('old')); else h.requests[0].reject(new h.ApiError());
    await flush();
    assert.equal(h.render().user.token, 'new'); assert.equal(h.token, 'new');
  });
}

test('other-tab login/logout synchronizes credentials and invalidates a pending restore', async () => {
  const h = harness(); h.render(); h.otherTab(user('other'));
  h.requests[0].resolve(user('old')); await flush();
  assert.equal(h.render().user.token, 'other'); assert.equal(h.token, 'other');
  h.otherTab(null); assert.equal(h.render().user, null); assert.equal(h.token, null);
});

test('an old login response cannot undo a newer cross-tab login', async () => {
  const h = harness(); h.render();
  const login = h.render().login({}); h.otherTab(user('other'));
  h.requests[1].resolve(user('late')); assert.equal(await login, false);
  assert.equal(h.render().user.token, 'other'); assert.equal(h.token, 'other');
});
