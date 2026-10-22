const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runtimeSpecifiers, sourceGraph, findCycles } = require('./helpers/sourceGraph.cjs');

test('dependency inspection includes re-exports and lazy imports, but ignores type-only references', () => {
  assert.deepEqual(runtimeSpecifiers(`
    import type { A } from './types';
    import { type B } from './otherTypes';
    export type { C } from './exportedTypes';
    export { type D } from './moreTypes';
    import './screen.css';
    import {} from './emptyImport';
    export {} from './emptyExport';
    import { type T, value } from './values';
    import Default, { type Named } from './defaultWithTypes';
    import * as Namespace from './namespace';
    export { value as named } from './public';
    export * from './shared';
    const lazy = () => import('./dialog');
    type Imported = import('./onlyTypes').T;
  `), ['./screen.css', './emptyImport', './emptyExport', './values', './defaultWithTypes', './namespace', './public', './shared', './dialog']);
  assert.deepEqual(findCycles(new Map([['A', ['B']], ['B', ['A']]])), [['A', 'B', 'A']]);
  assert.deepEqual(findCycles(new Map([['A', ['B']], ['B', []]])), []);
});

test('frontend runtime dependency graph stays acyclic, including lazy screen imports', () => {
  const root = path.join(__dirname, '../src');
  const graph = sourceGraph(root);
  assert(graph.has(path.join(root, 'features/payments/useInvoiceReview.ts')));
  assert.deepEqual(findCycles(graph).map(cycle => cycle.map(file => path.relative(root, file))), []);
});
