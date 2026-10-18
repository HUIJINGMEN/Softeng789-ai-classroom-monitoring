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
  vm.runInNewContext(code, { module, exports: module.exports, Headers,
    fetch: (url, init) => new Promise(resolve => calls.push({ url, init, resolve })) });
  module.exports.setUnauthorizedHandler(() => logouts++);
  return { api: module.exports, calls, get logouts() { return logouts; } };
}
const denied = () => ({ ok: false, status: 401, json: async () => ({ detail: 'Sign in required' }) });
for (const method of ['request', 'requestBlob']) {
  test(`${method}: obsolete 401 cannot sign out a new login, including switching away and back`, async () => {
    for (const next of ['new-token', 'old-token']) {
      const h = harness(); h.api.setAuthToken('old-token');
      const pending = h.api[method]('/api/private').catch(() => {});
      h.api.setAuthToken('new-token'); h.api.setAuthToken(next);
      h.calls[0].resolve(denied()); await pending;
      assert.equal(h.logouts, 0);
    }
  });
  test(`${method}: current session rejection signs out, anonymous rejection does not`, async () => {
    for (const token of [null, 'current-token']) {
      const h = harness(); h.api.setAuthToken(token);
      const pending = h.api[method]('/api/private').catch(() => {});
      h.calls[0].resolve(denied()); await pending;
      assert.equal(h.logouts, token ? 1 : 0);
    }
  });
}
test('explicit unrelated credentials cannot clear the current session', async () => {
  const h = harness(); h.api.setAuthToken('current');
  const pending = h.api.request('/api/private', { headers: { Authorization: 'Bearer other' } }).catch(() => {});
  h.calls[0].resolve(denied()); await pending; assert.equal(h.logouts, 0);
});
