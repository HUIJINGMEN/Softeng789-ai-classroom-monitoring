const assert = require('node:assert/strict');
const { join } = require('node:path');
const test = require('node:test');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const code = buildSync({ entryPoints: [join(__dirname, '../src/features/report-review/runSequential.ts')],
  bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const compiled = new Module(__filename, module);
compiled._compile(code, __filename);
const { runSequential } = compiled.exports;

test('empty operations preserve state without invoking a request', async () => {
  const initial = { version: 1 };
  assert.equal(await runSequential([], initial, () => assert.fail('No operation')), initial);
});

test('first request starts immediately and later requests wait for the returned state', async () => {
  const calls = []; let release;
  const pending = runSequential(['first', 'second'], 1, (version, item, index) => {
    calls.push([version, item, index]);
    if (item === 'first') return new Promise(resolve => { release = resolve; });
    return version + 1;
  });
  assert.deepEqual(calls, [[1, 'first', 0]]);
  release(2);
  assert.equal(await pending, 3);
  assert.deepEqual(calls, [[1, 'first', 0], [2, 'second', 1]]);
});

test('a rejected operation stops all remaining requests', async () => {
  const calls = [];
  await assert.rejects(runSequential(['first', 'second', 'third'], 1, async (version, item) => {
    calls.push(item);
    if (item === 'second') throw new Error('Version conflict');
    return version + 1;
  }), /Version conflict/);
  assert.deepEqual(calls, ['first', 'second']);
});
