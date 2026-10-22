const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const {buildSync} = require('esbuild');

const root = path.join(__dirname, '..');
const code = buildSync({
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: {'import.meta.env': '{}'},
  stdin: {
    contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import PaymentMethod from './src/features/payments/components/PaymentMethodModal'; export const render=props=>renderToStaticMarkup(React.createElement(PaymentMethod,props));",
    resolveDir: root, loader: 'tsx'
  }, external: ['react', 'react/jsx-runtime', 'react-dom/server']
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded.paths = module.paths;
loaded._compile(code, __filename);
const props = {
  studentId: 'student', invoice: {id: 'invoice', title: 'Lessons', balance: 25, currency: 'NZD'},
  account: {}, onClose() {}, onDemoCheckout() {}, onSubmitted() {}
};

test('bank/cash capability renders no card or demo checkout regardless of legacy demoMode', () => {
  const html = loaded.exports.render({...props, demoMode: true, paymentMethods: ['BANK_TRANSFER', 'CASH']});
  assert(html.includes('Bank transfer'));
  assert(html.includes('Cash'));
  assert(!html.includes('Demo checkout'));
  assert(!html.includes('Pay by card'));
  assert(!html.includes('secure card checkout'));
});

test('explicit demo capability is labelled a demonstration, never a real card payment', () => {
  const html = loaded.exports.render({...props, paymentMethods: ['BANK_TRANSFER', 'CASH', 'DEMO_CHECKOUT']});
  assert(html.includes('Demo checkout'));
  assert(html.includes('no money is collected'));
  assert(!html.includes('Pay by card'));
});

test('missing/unknown capabilities fail closed and unconfigured bank transfer stays disabled', () => {
  for (const paymentMethods of [undefined, [], ['CARD']]) {
    const html = loaded.exports.render({...props, paymentMethods});
    assert(html.includes('Payment methods are unavailable'));
    assert(!html.includes('payment-method-option'));
  }
  const html = loaded.exports.render({...props, account: null, paymentMethods: ['BANK_TRANSFER', 'CASH']});
  assert(html.includes('disabled=""'));
  assert(html.includes('Bank details have not been published yet'));
  assert(html.includes('Cash'));
});
