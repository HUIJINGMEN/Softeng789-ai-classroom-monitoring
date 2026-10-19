const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
function bundle(file, external = []) {
  return buildSync({ entryPoints: [path.join(__dirname, '../src/features/account-access', file)],
    bundle: true, write: false, platform: 'node', format: 'cjs', loader: { '.css': 'empty' }, external }).outputFiles[0].text;
}
function load(code, deps = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, TextEncoder,
    require: name => deps[name] ?? require(name) });
  return module.exports;
}
const model = load(bundle('accountLinkModel.ts'));
test('proofs are accepted only from one exact fragment, not queries or redirect payloads', () => {
  const token = 'a'.repeat(43);
  assert.equal(model.parseAccountLinkHash('#account-link=' + token), token);
  assert.equal(model.parseAccountLinkHash('?account-link=' + token), null);
  for (const suffix of ['', token + '&redirect=https://evil.test', '../secret', token + '%00']) {
    assert.equal(model.parseAccountLinkHash('#account-link=' + suffix), '');
  }
});
test('reset and registration share UTF-8 password bounds and confirmation policy', () => {
  assert.equal(model.passwordIssue('好'.repeat(24), '好'.repeat(24)), '');
  assert.match(model.passwordIssue('好'.repeat(25), '好'.repeat(25)), /72 UTF-8 bytes/);
  assert.match(model.passwordIssue('short', 'short'), /8 characters/);
  assert.match(model.passwordIssue('valid-password', 'different'), /do not match/);
});
test('account access sends proof in same-origin POST body, never in route or authorization header', async () => {
  const calls = [];
  const api = load(bundle('api.ts', ['../../lib/apiClient']), { '../../lib/apiClient': {
    request: async (route, options) => { calls.push({ route, options }); return { message: 'Accepted' }; }
  } });
  await api.inspectAccountLink('secret-proof'); await api.resetAccountPassword('secret-proof', 'secret-password');
  await api.requestAccountLink('person@example.test', 'PASSWORD_RESET');
  assert.deepEqual(calls.map(call => call.route), ['/api/auth/account-links/inspect',
    '/api/auth/account-links/reset-password', '/api/auth/account-links']);
  for (const call of calls) {
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers.Authorization, undefined);
    assert.ok(!call.route.includes('secret'));
  }
  assert.equal(JSON.parse(calls[1].options.body).token, 'secret-proof');
});

function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  const children = [element.props?.children].flat(Infinity);
  return [element, ...children.flatMap(nodes)];
}
function formHarness(send) {
  const state = []; let cursor = 0;
  const react = {
    ...require('react'),
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }]; },
    useRef(initial) { const i = cursor++; return state[i] ??= { current: initial }; }
  };
  const component = load(bundle('AccountLinkRequestForm.tsx', ['react', 'react/jsx-runtime', './api', '../../lib/apiClient']), {
    react, './api': { requestAccountLink: send }, '../../lib/apiClient': { apiMessage: failure => failure.message }
  }).default;
  const props = { purpose: 'PASSWORD_RESET', onBack() {} };
  const render = () => { cursor = 0; return component(props); };
  return { render, enter(value) { nodes(render()).find(node => node.type === 'input' && node.props.type === 'email')
    .props.onChange({ target: { value } }); } };
}
test('request form prevents double submission and does not reveal whether an account exists', async () => {
  let resolve; let calls = 0;
  const h = formHarness(() => { calls++; return new Promise(done => { resolve = done; }); });
  h.enter('person@example.test');
  const first = h.render().props.onSubmit({ preventDefault() {} });
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 1);
  assert.ok(nodes(h.render()).find(node => node.type === 'button' && node.props.type === 'submit').props.disabled);
  resolve({ message: 'If this address is eligible, check your inbox.' }); await first;
  assert.ok(nodes(h.render()).some(node => node.props?.role === 'status'));
});
test('disabled mail is an explicit failure, preserves the address and offers a retry', async () => {
  const h = formHarness(async () => { throw new Error('Account email is not configured yet; no email was sent.'); });
  h.enter('person@example.test'); await h.render().props.onSubmit({ preventDefault() {} });
  const view = nodes(h.render());
  assert.ok(view.some(node => node.props?.role === 'alert'));
  assert.ok(!view.some(node => node.props?.role === 'status'));
  assert.equal(view.find(node => node.type === 'input').props.value, 'person@example.test');
  assert.equal(view.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});
