const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const {buildSync} = require('esbuild');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

const code = buildSync({stdin: {resolveDir: path.join(__dirname, '../src/features/payments'), loader: 'ts', contents: `
  export {default as Desktop} from './components/AdminPaymentOverview';
  export {default as Mobile} from './components/AdminMobilePaymentSummary';
  export {toAdminPaymentSummaryView} from './adminPaymentViewModel';
`}, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime']}).outputFiles[0].text;
const bundled = {exports: {}};
vm.runInNewContext(code, {module: bundled, exports: bundled.exports, require});
const {Desktop, Mobile, toAdminPaymentSummaryView} = bundled.exports;

for (const Component of [Desktop, Mobile]) {
  test(`${Component.name} preserves backend-issued amounts, settled percentages and invoice count units`, () => {
    const summary = toAdminPaymentSummaryView({issued: 150, collected: 100, outstanding: 100,
      collectionRate: 33, overdueCount: 2, openCount: 2, draftCount: 0, currency: 'NZD'});
    const html = renderToStaticMarkup(React.createElement(Component, {summary, loading: false,
      onShowDrafts() {}, onShowOverdue() {}, onCreate() {}}));
    assert.match(html, /Overdue invoices/);
    assert.doesNotMatch(html, /overdue accounts/i);
    assert.match(html, /\$150\.00/);
    assert.doesNotMatch(html, /\$200\.00/);
    assert.match(html, /33%/);
    assert.match(html, /33% of issued charges settled/);
  });
}
