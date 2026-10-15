const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const code = buildSync({ entryPoints: [join(__dirname, '../src/components/Modal.tsx')],
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react/jsx-runtime'] }).outputFiles[0].text;

function environment(previousLock) {
  const body = { dataset: {}, style: { overflow: 'auto' } };
  if (previousLock !== undefined) body.dataset.modalScrollLock = previousLock;
  const effects = [];
  const react = { useId: () => 'test', useRef: () => ({ current: null }),
    useEffect: effect => effects.push(effect) };
  const compiled = { exports: {} };
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports,
    document: { body }, require: name => name === 'react' ? react : require(name) });
  return { body, mount: () => {
    effects.length = 0;
    compiled.exports.default({ onClose: () => {}, size: 'wide', title: 'Test' });
    return effects[0]();
  } };
}

test('nested dialogs keep the page locked until the final dialog closes', () => {
  const view = environment();
  const closeFirst = view.mount(), closeSecond = view.mount();
  assert.equal(view.body.dataset.modalScrollLock, 'true');
  closeFirst();
  assert.equal(view.body.dataset.modalScrollLock, 'true');
  closeSecond();
  assert.equal(view.body.dataset.modalScrollLock, undefined);
  assert.equal(view.body.style.overflow, 'auto', 'never writes inline overflow');
});

test('dialog cleanup restores the previous attribute and can be mounted again', () => {
  const view = environment('existing-lock');
  view.mount()();
  assert.equal(view.body.dataset.modalScrollLock, 'existing-lock');
  const close = view.mount();
  assert.equal(view.body.dataset.modalScrollLock, 'true');
  close();
  assert.equal(view.body.dataset.modalScrollLock, 'existing-lock');
});

test('modal scrolling is locked only on screen, leaving print pagination unrestricted', () => {
  const css = readFileSync(join(__dirname, '../src/styles/theme.css'), 'utf8');
  assert.match(css, /@media screen\s*\{\s*body\[data-modal-scroll-lock='true'\]\s*\{\s*overflow: hidden;/);
  const modal = readFileSync(join(__dirname, '../src/components/Modal.tsx'), 'utf8');
  assert(!modal.includes('body.style.overflow'));
});
