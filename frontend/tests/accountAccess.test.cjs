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
test('email screening bounds input first and uses unambiguous address/domain separators', () => {
  for (const value of ['person@example.test', 'first.last+tag@sub.example.test', 'a'.repeat(242) + '@example.test']) {
    assert.equal(model.isAccountEmail(value), true, value);
  }
  for (const value of ['', 'missing-domain@', '@example.test', 'a@@example.test', 'a@example',
    'a@.test', 'a@example.', 'a@sub..example.test', 'a b@example.test', 'a@example.test\n',
    'a'.repeat(243) + '@example.test', 'a'.repeat(100000) + '@']) {
    assert.equal(model.isAccountEmail(value), false);
  }
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
  assert.ok(nodes(h.render()).some(node => node.type === 'output'));
});
test('disabled mail is an explicit failure, preserves the address and offers a retry', async () => {
  const h = formHarness(async () => { throw new Error('Account email is not configured yet; no email was sent.'); });
  h.enter('person@example.test'); await h.render().props.onSubmit({ preventDefault() {} });
  const view = nodes(h.render());
  assert.ok(view.some(node => node.props?.role === 'alert'));
  assert.ok(!view.some(node => node.type === 'output'));
  assert.equal(view.find(node => node.type === 'input').props.value, 'person@example.test');
  assert.equal(view.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

function accountPage({ details = null, loading = false, done = false } = {}) {
  let cursor = 0;
  const values = [details, loading, '', false, done, '', '', false];
  const react = {
    ...require('react'),
    useState: initial => [values[cursor++] ?? initial, () => {}],
    useRef: initial => ({ current: initial }),
    useEffect() {},
  };
  const component = load(bundle('../../pages/AccountAccessPage.tsx', [
    'react', 'react/jsx-runtime', './AuthPage', '../components/PasswordField',
    '../lib/apiClient', '../features/account-access/api',
  ]), {
    react, './AuthPage': () => null, '../components/PasswordField': () => null,
    '../lib/apiClient': { apiMessage: error => error.message }, '../features/account-access/api': {},
  }).default;
  return nodes(component({ token: 'test-proof', auth: {} }));
}

test('password reset uses an explicit submit button and navigation never submits the form', () => {
  const details = { purpose: 'PASSWORD_RESET', email: 'person@example.test' };
  const resetButtons = accountPage({ details }).filter(node => node.type === 'button');
  assert.equal(resetButtons.length, 2);
  assert.equal(resetButtons[0].props.type, 'submit');
  assert.equal(resetButtons[1].props.type, 'button');
  const doneButtons = accountPage({ details, done: true }).filter(node => node.type === 'button');
  assert.equal(doneButtons.length, 1);
  assert.equal(doneButtons[0].props.type, 'button');
});

test('link inspection and request confirmation use semantic status output with phrasing content', async () => {
  assert.equal(accountPage({ loading: true }).some(node => node.type === 'output'), true);
  const h = formHarness(async () => ({ message: 'If eligible, check your inbox.' }));
  h.enter('person@example.test');
  await h.render().props.onSubmit({ preventDefault() {} });
  const output = nodes(h.render()).find(node => node.type === 'output');
  assert.equal(output.props.children, 'If eligible, check your inbox.');
  assert.equal(nodes(output).some(node => ['h3', 'p', 'div', 'section'].includes(node.type)), false);
});
