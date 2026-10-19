const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/lib/apiClient.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' } }).outputFiles[0].text;
function harness() {
  const calls = [], module = { exports: {} };
  let logouts = 0;
  vm.runInNewContext(code, { module, exports: module.exports, Headers, Response,
    fetch: (url, init) => new Promise(resolve => calls.push({ url, init, resolve })) });
  module.exports.setUnauthorizedHandler(() => logouts++);
  return { api: module.exports, calls, get logouts() { return logouts; } };
}
const denied = () => ({ ok: false, status: 401, json: async () => ({ detail: 'Sign in required' }) });
for (const method of ['request', 'requestBlob']) {
  test(`${method}: obsolete 401 cannot sign out a new login, including switching away and back`, async () => {
    for (const next of [true, false]) {
      const h = harness(); h.api.setSessionAuthenticated(true);
      const pending = h.api[method]('/api/private').catch(() => {});
      h.api.setSessionAuthenticated(false); h.api.setSessionAuthenticated(next);
      h.calls[0].resolve(denied()); await pending;
      assert.equal(h.logouts, 0);
    }
  });
  test(`${method}: current session rejection signs out, anonymous rejection does not`, async () => {
    for (const authenticated of [false, true]) {
      const h = harness(); h.api.setSessionAuthenticated(authenticated);
      const pending = h.api[method]('/api/private').catch(() => {});
      h.calls[0].resolve(denied()); await pending;
      assert.equal(h.logouts, authenticated ? 1 : 0);
    }
  });
}
test('caller-supplied Bearer headers and external/backslash paths are never transmitted', async () => {
  const h = harness(); h.api.setSessionAuthenticated(true);
  await assert.rejects(h.api.request('/api/private', {headers: {Authorization: 'Bearer other'}}), /no longer supported/);
  for (const path of ['//other.test/api/private', '/\\other.test', 'https://other.test/api/private']) {
    await assert.rejects(h.api.request(path), /Invalid API path/);
  }
  assert.equal(h.calls.length, 0); assert.equal(h.logouts, 0);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
test('writes obtain CSRF proof first and send same-origin cookies without a Bearer header', async () => {
  const h = harness(); const result = h.api.request('/api/write', {method: 'POST'});
  assert.equal(h.calls[0].url, '/api/auth/csrf');
  h.calls[0].resolve(Response.json({headerName:'X-CSRF-TOKEN', token:'masked-proof'})); await flush();
  assert.equal(h.calls[1].init.headers.get('X-CSRF-TOKEN'), 'masked-proof');
  assert.equal(h.calls[1].init.headers.has('Authorization'), false);
  assert.equal(h.calls[1].init.credentials, 'same-origin');
  h.calls[1].resolve(Response.json({saved:true})); assert.equal((await result).saved, true);
});
test('a login change while fetching CSRF proof prevents the old write from being sent', async () => {
  const h=harness(); const result=h.api.request('/api/write', {method:'POST'});
  h.api.setSessionAuthenticated(true);
  h.calls[0].resolve(Response.json({headerName:'X-CSRF-TOKEN',token:'old-proof'}));
  await assert.rejects(result,/login changed/); assert.equal(h.calls.length,1);
});
test('account-mismatched successful responses cannot be exposed after a cross-tab cookie change', async () => {
  const h=harness(); h.api.setSessionAuthenticated(true,'ADMIN:expected');
  const result=h.api.request('/api/private');
  h.calls[0].resolve(Response.json({private:'other account'}, {headers:{'X-ClassLens-Account':'STUDENT:other'}}));
  await assert.rejects(result,/account changed/); assert.equal(h.logouts,1);
});
test('each operation obtains fresh CSRF even after a successful write', async () => {
  const h=harness();
  for(let index=0;index<2;index++) {
    const pending=h.api.request('/api/write',{method:'POST'});
    assert.equal(h.calls[index*2].url,'/api/auth/csrf');
    h.calls[index*2].resolve(Response.json({headerName:'X-CSRF-TOKEN',token:`proof-${index}`}));await flush();
    assert.equal(h.calls[index*2+1].init.headers.get('X-CSRF-TOKEN'),`proof-${index}`);
    h.calls[index*2+1].resolve(Response.json({ok:true}));await pending;
  }
});
test('a denied write is not automatically replayed and the next explicit retry obtains fresh CSRF', async () => {
  const h=harness(); const result=h.api.request('/api/write',{method:'POST'});
  h.calls[0].resolve(Response.json({headerName:'X-CSRF-TOKEN',token:'proof'})); await flush();
  h.calls[1].resolve(Response.json({detail:'Refresh the page'}, {status:403}));
  await assert.rejects(result,/Refresh/); assert.equal(h.calls.length,2);
  const retry=h.api.request('/api/write',{method:'POST'});
  assert.equal(h.calls[2].url,'/api/auth/csrf');
  h.calls[2].resolve(Response.json({headerName:'X-CSRF-TOKEN',token:'new-proof'})); await flush();
  h.calls[3].resolve(Response.json({saved:true})); await retry;
});
