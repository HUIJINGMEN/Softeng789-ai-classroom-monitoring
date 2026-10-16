const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const {readFileSync} = require('node:fs');
const {buildSync} = require('esbuild');
const root = path.join(__dirname, '..');
const options = {bundle:true, write:false, platform:'node', format:'cjs', jsx:'automatic', define:{'import.meta.env':'{}'}, loader:{'.css':'empty'}};
const renderCode = buildSync({...options, stdin:{contents:"import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Review from './src/features/payments/components/ReviewPaymentModal'; export const render=payment=>renderToStaticMarkup(React.createElement(Review,{payment,onClose(){},onReviewed(){}})); export * from './src/features/payments/manualPaymentReviewModel';", resolveDir:root, loader:'tsx'}, external:['react','react/jsx-runtime','react-dom/server']}).outputFiles[0].text;
const loaded = new Module(__filename,module); loaded.paths=module.paths; loaded._compile(renderCode,__filename);
const api=loaded.exports;
const payment = {id:'receipt-1', invoiceId:'invoice-1', studentId:'student-1', studentName:'Maia Rangi', studentNumber:'DEMO-2604', invoiceTitle:'Weekly lessons', invoiceNumber:'INV-2026-01', invoiceBalance:500, currency:'NZD', amount:500, method:'BANK_TRANSFER', status:'PENDING', studentNote:'Paid by bank transfer this morning.\nPlease check.', receiptFileName:'receipt.pdf', receiptFileSize:128, submittedAt:'2026-10-10T19:45:00Z'};

test('review shows explicit currency, invoice/balance and Auckland submission time',()=>{
  const html=api.render(payment);
  for(const text of ['NZD','500.00','INV-2026-01','Weekly lessons','Outstanding before this payment','11 Oct 2026','NZDT','Paid by bank transfer','Required to reject','student can see']) assert(html.includes(text),text);
  assert.equal(api.manualPaymentReviewError('APPROVED',''),'');
  for(const note of ['', ' \n\t ']) assert(api.manualPaymentReviewError('REJECTED',note).includes('rejection reason'));
  assert.equal(api.manualPaymentReviewError('REJECTED','Readable reason'),'');
  assert(html.includes('Submitted receipt'));assert(html.includes('Loading receipt'));assert(!html.includes('>Open receipt<'));
  assert(!html.includes('modal__foot--compact'));
});
test('theme-safe notes wrap long content; missing balances cannot silently allow approval',()=>{
  const css=readFileSync(path.join(root,'src/features/payments/payment-receipt-preview.css'),'utf8');
  const rule=css.match(/\.bank-transfer-review__note \{([^}]+)\}/)[1];
  assert(rule.includes('var(--panel-2)'));assert(!rule.includes('var(--surface-2)'));
  assert(css.includes('white-space: pre-wrap'));assert(css.includes('overflow-wrap: anywhere'));
  const html=api.render({...payment,invoiceBalance:undefined,studentNote:'<script>bad</script>'});
  assert(html.includes('Balance unavailable'));assert(html.includes('disabled="">Approve payment'));
  assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
});

const behaviorCode=buildSync({...options,entryPoints:[path.join(root,'src/features/payments/components/ReviewPaymentModal.tsx')], external:['react','react/jsx-runtime','./api','./usePaymentReceipt','../../../components/Modal']}).outputFiles[0].text;
function harness(data=payment,receiptStatus='ready'){
  let cursor=0,focused=0,reviewed=0;const values=[],requests=[];
  const react={useId:()=> 'note-id',useRef:initial=>{const i=cursor++;return values[i]??(values[i]={current:initial});},useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
  const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
  const module={exports:{}};
  vm.runInNewContext(behaviorCode,{module,exports:module.exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?runtime:id==='./usePaymentReceipt'?{usePaymentReceipt:()=>({status:receiptStatus})}:id==='./api'?{reviewManualPayment:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject}))}:id==='../../../components/Modal'?function Modal(){}:require(id),Intl,Date,URL,window:{}});
  const find=(node,type)=>{if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}return null;};
  return {requests,get focused(){return focused;},get reviewed(){return reviewed;},render(){cursor=0;const modal=module.exports.default({payment:data,onClose(){},onReviewed(){reviewed++;}});const textarea=find(modal,'textarea');textarea.props.ref.current={focus(){focused++;}};const buttons=modal.props.footer.props.children.filter(child=>child?.type==='button');return{modal,textarea,reject:buttons[0],approve:buttons[1]};}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('cash submission sends plain form fields without a fabricated receipt; transfers retain their file',async()=>{
  const code=buildSync({...options,entryPoints:[path.join(root,'src/features/payments/api/manualPayments.ts')]}).outputFiles[0].text;
  const compiled=new Module(__filename,module);compiled.paths=module.paths;compiled._compile(code,__filename);
  const originalFetch=global.fetch,calls=[];
  global.fetch=async(url,init)=>{calls.push({url,...init});return Response.json({status:'PENDING'});};
  try {
    await compiled.exports.submitManualPayment('student-1','invoice-1','CASH',25,' Paid at reception ',null);
    const cash=calls[0].body;
    assert.equal(cash.get('method'),'CASH');assert.equal(cash.get('amount'),'25.00');
    assert.equal(cash.get('note'),'Paid at reception');assert.equal(cash.has('receipt'),false);
    const file=new File(['receipt'],'receipt.pdf',{type:'application/pdf'});
    await compiled.exports.submitManualPayment('student-1','invoice-1','BANK_TRANSFER',25,'',file);
    assert.equal(calls[1].body.get('receipt').name,'receipt.pdf');
  } finally {global.fetch=originalFetch;}
});
test('student cash form permits an empty attachment while transfer submission remains blocked',async()=>{
  const code=buildSync({...options,entryPoints:[path.join(root,'src/features/payments/components/PaymentMethodModal.tsx')],external:['react','react/jsx-runtime','../api','../../../components/Modal']}).outputFiles[0].text;
  let cursor=0,submitted=0;const values=[],calls=[];
  const react={useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=next;}];}};
  const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
  const mod={exports:{}};
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?runtime:id==='../api'?{submitManualPayment:async(...args)=>{calls.push(args);}}:id==='../../../components/Modal'?function Modal(){}:require(id),Intl,Date});
  const render=()=>{cursor=0;return mod.exports.default({studentId:'student-1',invoice:{id:'invoice-1',title:'Lessons',balance:25,currency:'NZD'},account:{},demoMode:false,onClose(){},onCardPayment(){},onSubmitted(){submitted++;}});};
  const choices=render().props.children.props.children;
  choices[2].props.onClick();
  let modal=render();assert.equal(modal.props.footer.props.children[1].props.disabled,false);
  const form=modal.props.children.type(modal.props.children.props);
  const upload=form.props.children.find(child=>child?.type==='label'&&child.props.className.startsWith('manual-payment-upload'));
  assert.equal(upload.props.children[0].props.required,false);
  await modal.props.onSubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(calls[0][2],'CASH');assert.equal(calls[0][5],null);assert.equal(submitted,1);
  modal=render();modal.props.footer.props.children[0].props.onClick();
  render().props.children.props.children[1].props.onClick();
  modal=render();assert.equal(modal.props.footer.props.children[1].props.disabled,true);
  await modal.props.onSubmit({preventDefault(){}});assert.equal(calls.length,1);
});
test('blank rejection stays local, focuses its field and a failed review preserves the entered reason',async()=>{
  const h=harness();h.render().reject.props.onClick();assert.equal(h.requests.length,0);assert.equal(h.focused,1);
  assert.equal(h.render().textarea.props['aria-invalid'],true);
  h.render().textarea.props.onChange({target:{value:'  Please upload a clearer receipt.  '}});
  h.render().reject.props.onClick();h.render().reject.props.onClick();assert.equal(h.requests.length,1);
  assert.deepEqual(Array.from(h.requests[0].args),['receipt-1','REJECTED','Please upload a clearer receipt.']);
  assert.equal(h.render().modal.props.closeDisabled,true);
  h.requests[0].reject(new Error('offline'));await flush();
  assert.equal(h.render().textarea.props.value,'  Please upload a clearer receipt.  ');assert.equal(h.render().modal.props.closeDisabled,false);
  h.render().reject.props.onClick();h.requests[1].resolve({});await flush();assert.equal(h.reviewed,1);
});
test('approval allows an optional note, serializes actions and guards absent or exceeded balances',async()=>{
  const h=harness();h.render().approve.props.onClick();h.render().reject.props.onClick();assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].args[1],'APPROVED');assert.equal(h.requests[0].args[2],'');
  h.requests[0].resolve({});await flush();assert.equal(h.reviewed,1);
  for(const balance of [undefined,400]){const blocked=harness({...payment,invoiceBalance:balance});assert.equal(blocked.render().approve.props.disabled,true);blocked.render().approve.props.onClick();assert.equal(blocked.requests.length,0);}
});
test('manual bank verification can approve independently of receipt preview availability',async()=>{
  for(const state of ['loading','error','none','ready']){
    const h=harness(payment,state);assert.equal(h.render().approve.props.disabled,false);
    assert.equal(h.render().reject.props.disabled,false);
    h.render().approve.props.onClick();h.render().approve.props.onClick();assert.equal(h.requests.length,1);
    assert.equal(h.requests[0].args[1],'APPROVED');
    h.requests[0].resolve({});await flush();assert.equal(h.reviewed,1);
    const blocked=harness({...payment,invoiceBalance:400},state);
    assert.equal(blocked.render().approve.props.disabled,true);
    blocked.render().approve.props.onClick();assert.equal(blocked.requests.length,0);
  }
  const html=api.render(payment);
  assert(html.includes('Approving confirms you verified the transfer in the bank account.'));
  assert(!html.includes('Approval disabled'));
});
test('cash without a receipt can be manually approved, but never bypasses the balance check',async()=>{
  const cash={...payment,method:'CASH',receiptFileName:null,receiptFileSize:0};
  assert.equal(api.hasPaymentReceipt(cash),false);assert.equal(api.hasPaymentReceipt(payment),true);
  for(const state of ['none','error','loading']){
    const h=harness(cash,state);assert.equal(h.render().approve.props.disabled,false);
    h.render().approve.props.onClick();assert.equal(h.requests.length,1);assert.equal(h.requests[0].args[1],'APPROVED');
    h.requests[0].resolve({});await flush();assert.equal(h.reviewed,1);
  }
  assert.equal(harness({...cash,invoiceBalance:400},'none').render().approve.props.disabled,true);
  const html=api.render(cash);assert(html.includes('Verify cash received'));assert(html.includes('Receipt optional'));
  assert(html.includes('Reject payment'));assert(!html.includes('Approval disabled'));
});
test('mobile review status spans a full row above two equally sized actions',()=>{
  const css=readFileSync(path.join(root,'src/features/payments/payment-receipt-preview.css'),'utf8');
  const mobile=css.slice(css.indexOf('@media (max-width: 760px)'));
  assert(mobile.includes('.bank-transfer-review-modal.modal .modal__foot { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert(mobile.includes('.bank-transfer-review__receipt-status { grid-column: 1 / -1; min-width: 0;'));
});
