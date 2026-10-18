const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const bundle = buildSync({
  stdin: { resolveDir: path.join(__dirname, '..'), loader: 'tsx', contents: `
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {StudentInvoiceCard, StudentInvoiceHistoryRow} from './src/features/payments/components/StudentInvoiceCards';
    import MobilePayments from './src/features/payments/components/MobileStudentPaymentsView';
    import StudentOverview from './src/components/student/StudentOverviewView';
    export * from './src/features/payments/studentPaymentModel';
    export * from './src/features/payments/invoiceReviewModel';
    export * from './src/features/payments/format';
    export * from './src/components/student/studentPortalMetrics';
    export * from './src/lib/sessionTime';
    export const renderCard = invoice => renderToStaticMarkup(<StudentInvoiceCard invoice={invoice} onChoosePayment={()=>{}}/>);
    export const renderHistory = invoice => renderToStaticMarkup(<StudentInvoiceHistoryRow invoice={invoice}/>);
    export const renderMobile = (invoice, historical=false) => renderToStaticMarkup(<MobilePayments
      statement={{amountDue:invoice.balance, currency:'NZD', nextDueDate:null, invoices:[invoice]}}
      openInvoices={historical?[]:[invoice]} history={historical?[invoice]:[]} onDownload={()=>{}} onChoosePayment={()=>{}}/>);
    export const renderOverview = profile => renderToStaticMarkup(<StudentOverview profile={profile}
      user={{name:'Audit'}} history={[]} benchmark={null} reports={[]} accomplishments={[]}
      publishedReportCount={0} amountDue={0} paymentCurrency="NZD" paymentUnavailable={false}
      courses={['CURRENT', 'HISTORICAL', 'ANOTHER OLD COURSE']} loading={false} onOpenView={()=>{}}/>);
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' },
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']
});
const loaded = new Module(__filename, module);
loaded.paths = module.paths;
loaded._compile(bundle.outputFiles[0].text, __filename);
const model = loaded.exports;

function exampleInvoice() {
  return {
    id:'audit', title:'Audit statement', currency:'NZD', status:'PARTIALLY_PAID', dueDate:'2026-10-31',
    charges:100, credits:40, payments:50, balance:10, manualPayments:[], coursePurchases:[], note:null,
    lineItems:[{id:'charge',type:'CHARGE',description:'Fee',amount:100}, {id:'credit',type:'CREDIT',description:'Fee reduction',amount:40}],
    transactions:[
      {id:'paid',status:'SUCCEEDED',amount:100,provider:'MANUAL',occurredAt:'2026-10-17T11:30:00Z'},
      {id:'refund',status:'REFUNDED',amount:40,provider:'EXTERNAL_REFUND',occurredAt:'2026-10-18T01:00:00Z'},
      {id:'reversal',status:'REFUNDED',amount:10,provider:'ADMIN_CORRECTION',occurredAt:'2026-10-18T02:00:00Z'},
      {id:'failed',status:'FAILED',amount:999,provider:'DEMO',occurredAt:'2026-10-18T02:00:00Z'}
    ]
  };
}

test('posted statement rows reconcile receipts, refunds and reversals without counting failures or pending claims', () => {
  const invoice = exampleInvoice();
  invoice.manualPayments = [{id:'pending',status:'PENDING',amount:500}];
  const entries = model.statementPaymentEntries(invoice);
  assert.deepEqual(entries.map(row => row.balanceChange), [-100,40,10]);
  assert.deepEqual(entries.map(row => row.label), ['Payment received','Refund recorded','Payment reversed']);
  assert.equal(model.invoiceEntryCount(invoice), 5);
  assert.equal(invoice.charges - invoice.credits + entries.reduce((sum,row)=>sum+row.balanceChange,0), invoice.balance);
});

test('desktop and mobile open AND historical statements actually render all posted ledger rows and school dates', () => {
  const invoice = exampleInvoice();
  for (const render of [model.renderCard, model.renderHistory, value=>model.renderMobile(value), value=>model.renderMobile(value,true)]) {
    const html = render(invoice);
    for (const text of ['Payment received','Refund recorded','Payment reversed','Net payments','18 Oct 2026']) assert(html.includes(text), text);
    assert(!html.includes('17 Oct 2026'));
    assert(!html.includes('$999.00'));
    assert(html.includes('$10.00'));
  }
  const desktop=model.renderCard(invoice), mobile=model.renderMobile(invoice);
  assert.match(desktop, /has-value is-credit">−\$100\.00/);
  assert.match(desktop, /class="has-value">\$40\.00/);
  assert(mobile.includes('>−$100.00</b>'));
  assert(mobile.includes('>+$40.00</b>'));
});

test('statement balance effects reconcile exact cents across many partial refunds and reversals', () => {
  for(let cents=1;cents<=250;cents++) {
    const received=10000, refunded=cents, reversed=251-cents, credit=refunded;
    const invoice={...exampleInvoice(),charges:100,credits:credit/100,payments:(received-refunded-reversed)/100,
      balance:reversed/100,lineItems:[{id:'fee',type:'CHARGE',amount:100},{id:'credit',type:'CREDIT',amount:credit/100}],
      transactions:[{id:'paid',status:'SUCCEEDED',amount:received/100},
        {id:'refund',status:'REFUNDED',provider:'EXTERNAL_REFUND',amount:refunded/100},
        {id:'reversal',status:'REFUNDED',provider:'ADMIN_CORRECTION',amount:reversed/100}]};
    const postedCents=model.statementPaymentEntries(invoice).reduce((sum,row)=>sum+Math.round(row.balanceChange*100),0);
    assert.equal(10000-credit+postedCents,Math.round(invoice.balance*100));
    assert.equal(model.invoiceOverpayment(invoice),0);
  }
});

test('legacy surplus is exposed without floating-point residue or claiming an automatic refund', () => {
  const invoice = {...exampleInvoice(),status:'PAID',payments:100,credits:50,balance:0};
  assert.equal(model.invoiceOverpayment(invoice),50);
  for(const html of [model.renderCard(invoice),model.renderHistory(invoice),model.renderMobile(invoice,true)]) {
    assert(html.includes('Overpayment')); assert(html.includes('$50.00')); assert(html.includes('contact the administrator'));
  }
  assert.equal(model.invoiceOverpayment({...invoice,charges:0.3,payments:0.1,credits:0.2}),0);
});

test('adjustment feedback rejects surplus credits and non-cent inputs but preserves proper refunds and reversals', () => {
  const invoice=exampleInvoice();
  assert.equal(model.adjustmentLimit(invoice,'CREDIT'),10);
  assert.equal(model.adjustmentAmountError(invoice,'CREDIT','10.00'),null);
  assert.match(model.adjustmentAmountError(invoice,'CREDIT','10.01'),/current amount due/);
  for(const type of ['CREDIT','REFUND','PAYMENT_REVERSAL']) {
    for(const input of ['', '0','-1','99.995','NaN','Infinity','1e2','10000000000.00']) {
      assert(model.adjustmentAmountError(invoice,type,input), `${type}: ${input}`);
    }
  }
  assert.equal(model.adjustmentAmountError(invoice,'REFUND','50.00'),null);
  assert(model.adjustmentAmountError(invoice,'REFUND','50.01'));
  assert.equal(model.adjustmentLimit({...invoice,payments:100,credits:50,balance:0},'REFUND'),100);
  assert.equal(model.adjustmentAmountError({...invoice,balance:0},'CREDIT','0.01')?.includes('current amount due'),true);
});

test('Auckland calendar boundaries include midnight notes, exclude adjacent days and do not depend on host zone', () => {
  const original=process.env.TZ;
  try {
    for(const host of ['UTC','America/Los_Angeles','Asia/Shanghai','Pacific/Auckland']) {
      process.env.TZ=host;
      assert.equal(model.timestampInSchoolDateRange('2026-10-17T11:00:00Z','2026-10-18','2026-10-18'),true);
      assert.equal(model.timestampInSchoolDateRange('2026-10-17T10:59:59Z','2026-10-18','2026-10-18'),false);
      assert.equal(model.timestampInSchoolDateRange('2026-10-18T10:59:59Z','2026-10-18','2026-10-18'),true);
      assert.equal(model.timestampInSchoolDateRange('2026-10-18T11:00:00Z','2026-10-18','2026-10-18'),false);
      assert.equal(model.timestampInSchoolDateRange('invalid','2026-10-18','2026-10-18'),false);
      assert.equal(model.formatPaymentRecordedDate('2026-10-17T11:30:00Z'),'18 Oct 2026');
      assert.equal(model.formatPaymentDate('2026-10-18'),'18 Oct 2026');
      assert.equal(model.formatPaymentRecordedDate('invalid'),'Date unavailable');
      // Winter uses NZST (UTC+12), not the summer UTC+13 boundary.
      assert.equal(model.timestampInSchoolDateRange('2026-07-17T12:00:00Z','2026-07-18','2026-07-18'),true);
    }
  } finally {
    if(original===undefined) delete process.env.TZ; else process.env.TZ=original;
  }
});

test('active enrolments count distinct offering IDs, never historical course labels or legacy fallback text', () => {
  assert.equal(model.activeEnrollmentCount({courseOfferingIds:['term1','term2','term2'],courses:['SAME CODE']}),2);
  assert.equal(model.activeEnrollmentCount({courseOfferingIds:[],course:'Legacy label'}),0);
  assert.equal(model.activeEnrollmentCount(null),null);
  assert.equal(model.activeEnrollmentCount({course:'Legacy only'}),null);
  const html=model.renderOverview({name:'Audit',courseOfferingIds:['only-current'],courses:['CURRENT']});
  assert(html.includes('<b>1</b> active enrolment'));
  assert(!html.includes('<b>3</b> active enrolments'));
});
