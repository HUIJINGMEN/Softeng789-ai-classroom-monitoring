const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({entryPoints: [path.join(__dirname, '../src/hooks/useAuth.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs', external: ['react', '../lib/authApi', '../lib/apiClient']}).outputFiles[0].text;
const user = id => ({role: 'admin', id, name: id, email: id + '@example.test'});
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const values = [], effects = [], pending = [], requests = [], listeners = new Map();
  const storage = new Map([['classroomiq.auth', JSON.stringify(user('old'))]]);
  let cursor = 0, authenticated;
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
  vm.runInNewContext(code, {module, exports: module.exports, window: browser, crypto:require('node:crypto').webcrypto, require(name) {
    if (name === 'react') return react;
    if (name === '../lib/authApi') return api;
    if (name === '../lib/apiClient') return {ApiError, apiMessage: error => error.message, setSessionAuthenticated: value => { authenticated = value; }, setUnauthorizedHandler() {}};
    throw new Error(name);
  }});
  return {requests, ApiError, storage, get authenticated() {return authenticated;},
    render() {cursor = 0; const result = module.exports.useAuth(); pending.splice(0).forEach(fn => fn()); return result;},
    otherTab(next) {
      listeners.get('storage')({key: 'classlens.session-change', newValue:next?'login:notice':'logout:notice', storageArea: browser.localStorage});
    }};
}

for (const outcome of ['success', '401']) {
  test(`late restoration ${outcome} cannot overwrite or clear a newly logged-in session`, async () => {
    const h = harness(); h.render();
    const login = h.render().login({}); h.requests[1].resolve(user('new')); await login;
    if (outcome === 'success') h.requests[0].resolve(user('old')); else h.requests[0].reject(new h.ApiError());
    await flush();
    assert.equal(h.render().user.id, 'new'); assert.equal(h.authenticated, true);
  });
}

test('other-tab login/logout synchronizes credentials and invalidates a pending restore', async () => {
  const h = harness(); h.render(); h.otherTab(user('other'));
  h.requests[1].resolve(user('other')); await flush();
  h.requests[0].resolve(user('old')); await flush();
  assert.equal(h.render().user.id, 'other'); assert.equal(h.authenticated, true);
  h.otherTab(null); assert.equal(h.render().user, null); assert.equal(h.authenticated, false);
});

test('an old login response cannot undo a newer cross-tab login', async () => {
  const h = harness(); h.render();
  const login = h.render().login({}); h.otherTab(user('other'));
  h.requests[2].resolve(user('other')); await flush();
  h.requests[1].resolve(user('late')); assert.equal(await login, false);
  assert.equal(h.render().user.id, 'other'); assert.equal(h.authenticated, true);
});

test('legacy stored credentials are removed and never used to choose a workspace', async()=>{
  const h=harness(); assert.equal(h.render().user,null);
  assert.equal(h.storage.has('classroomiq.auth'),false);
  h.requests[0].reject(new h.ApiError()); await flush();
  assert.equal(h.render().user,null); assert.equal(h.render().restoring,false);
});
test('logout only claims success after server acknowledgement; failure retains an explicit warning', async()=>{
  const h=harness(); h.render(); h.requests[0].resolve(user('old')); await flush();
  const logout=h.render().logout(); h.requests[1].reject(new Error('offline')); await logout;
  assert.equal(h.render().user.id,'old'); assert.match(h.render().error,/may still be signed in/);
  const retry=h.render().logout(); h.requests[2].resolve(); await retry;
  assert.equal(h.render().user,null); assert.equal(h.render().busy,false);
  assert.match(h.storage.get('classlens.session-change'),/^logout:/);
  assert(!h.storage.has('classroomiq.auth'));
});

test('a failed sign-out is visible with a retry action and is excluded from printed reports',()=>{
  const Module=require('node:module');
  const source=buildSync({entryPoints:[path.join(__dirname,'../src/components/SessionNotice.tsx')],bundle:true,
    write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']}).outputFiles[0].text;
  const loaded=new Module(__filename,module);loaded.paths=module.paths;loaded._compile(source,__filename);
  const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
  const render=message=>renderToStaticMarkup(React.createElement(loaded.exports.default,{message,busy:false,onRetry(){}}));
  assert.equal(render(''),'');
  const html=render('You may still be signed in.');
  assert(html.includes('role="alert"'));assert(html.includes('Try signing out again'));
  const css=require('node:fs').readFileSync(path.join(__dirname,'../src/styles/auth.css'),'utf8');
  assert.match(css,/@media print\s*\{\s*body \.session-notice\s*\{\s*display: none;/);
});

test('registration converts independent photos concurrently but preserves metadata and upload order', async () => {
  const source = buildSync({
    entryPoints: [path.join(__dirname, '../src/lib/authApi.ts')], bundle: true,
    write: false, platform: 'node', format: 'cjs', external: ['./apiClient'],
  }).outputFiles[0].text;
  const module = { exports: {} };
  const photos = [];
  const requests = [];
  vm.runInNewContext(source, {
    module, exports: module.exports, Blob, File, FormData,
    fetch: url => new Promise(resolve => photos.push({ url, resolve })),
    require: () => ({
      request: async (route, options) => {
        requests.push({ route, options });
        return { role: 'STUDENT', id: 'student', name: 'Student', email: 'student@example.test', approvalStatus: 'PENDING' };
      },
    }),
  });
  const captures = [
    { pose: 'FRONT', photo: 'data:first', capturedAt: '2026-10-19T00:00:00Z' },
    { pose: 'LEFT', photo: 'data:second', capturedAt: '2026-10-19T00:00:01Z' },
  ];
  const result = module.exports.registerStudent({ email: 'student@example.test' }, captures);
  assert.deepEqual(photos.map(photo => photo.url), ['data:first', 'data:second']);
  photos[1].resolve({ blob: async () => new Blob(['second'], { type: 'image/jpeg' }) });
  await flush();
  assert.equal(requests.length, 0, 'registration waits for all images');
  photos[0].resolve({ blob: async () => new Blob(['first'], { type: 'image/jpeg' }) });
  assert.equal((await result).approvalStatus, 'PENDING');
  assert.equal(requests[0].route, '/api/auth/register/student');
  const body = requests[0].options.body;
  assert.deepEqual(JSON.parse(body.get('metadata')).map(capture => capture.pose), ['FRONT', 'LEFT']);
  const images = body.getAll('images');
  assert.deepEqual(images.map(file => file.name), ['FRONT.jpg', 'LEFT.jpg']);
  assert.deepEqual(await Promise.all(images.map(file => file.text())), ['first', 'second']);
});
