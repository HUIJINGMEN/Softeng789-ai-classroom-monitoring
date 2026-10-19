const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const vm=require('node:vm');
const Module=require('node:module');
const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:[path.join(__dirname,'../src/features/payments/usePaymentReceipt.ts')],bundle:true,write:false,platform:'node',format:'cjs',external:['react','./api/manualPayments','../../lib/apiClient']}).outputFiles[0].text;
function harness(){
  const values=[],effects=[],requests=[],revoked=[];let cursor=0,urlCount=0;
  class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
  const react={useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},useEffect:(effect,deps)=>{const i=cursor++;const before=effects[i];if(!before||deps.some((x,n)=>!Object.is(x,before.deps[n]))){before?.cleanup?.();effects[i]={deps,cleanup:effect()};}}};
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='react'?react:id==='./api/manualPayments'?{downloadAdminPaymentReceipt:(id,signal)=>new Promise((resolve,reject)=>requests.push({id,signal,resolve,reject}))}:{ApiError,apiMessage:error=>error.message},AbortController,URL:{createObjectURL:()=>`blob:receipt-${++urlCount}`,revokeObjectURL:url=>revoked.push(url)}});
  return{requests,revoked,ApiError,render:(id='one',attached=true)=>{cursor=0;return module.exports.usePaymentReceipt(id,attached);},unmount:()=>effects.forEach(effect=>effect?.cleanup?.())};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('receipt automatically loads on open, detects supported media and revokes its URL on close',async()=>{
  for(const type of ['application/pdf','image/jpeg','image/png','image/webp']){
    const h=harness();assert.equal(h.render().status,'loading');assert.equal(h.requests.length,1);
    h.requests[0].resolve({size:128,type});await flush();const result=h.render();
    assert.equal(result.status,'ready');assert.equal(result.kind,type==='application/pdf'?'pdf':'image');
    assert.equal(result.url,'blob:receipt-1');h.unmount();assert.equal(h.requests[0].signal.aborted,true);assert.deepEqual(h.revoked,['blob:receipt-1']);
  }
});
test('switching students never shows an earlier receipt, even if its cancelled request resolves late',async()=>{
  const h=harness();h.render('one');h.requests[0].resolve({size:128,type:'application/pdf'});await flush();assert.equal(h.render('one').status,'ready');
  const changed=h.render('two');assert.equal(changed.status,'loading');assert.equal(changed.url,undefined);assert.deepEqual(h.revoked,['blob:receipt-1']);
  h.requests[1].resolve({size:128,type:'image/png'});await flush();assert.equal(h.render('two').kind,'image');h.unmount();
  const late=harness();late.render('one');late.render('two');late.requests[0].resolve({size:128,type:'application/pdf'});await flush();assert.equal(late.render('two').status,'loading');assert.equal(late.render('two').url,undefined);late.unmount();
});
test('empty, unsafe and failed files expose recovery rather than rendering untrusted HTML',async()=>{
  for(const file of [{size:0,type:'application/pdf'},{size:128,type:'text/html'}]){
    const h=harness();h.render();h.requests[0].resolve(file);await flush();assert.equal(h.render().status,'error');assert.equal(h.render().url,undefined);h.unmount();
  }
  const h=harness();h.render();h.requests[0].reject(new Error('offline'));await flush();assert.equal(h.render().error,'offline');
  h.render().retry();h.render();assert.equal(h.requests.length,2);h.requests[1].resolve({size:128,type:'application/pdf'});await flush();assert.equal(h.render().status,'ready');
  h.render().failPreview();assert.equal(h.render().status,'error');assert(h.render().url);h.unmount();assert.deepEqual(h.revoked,['blob:receipt-1']);
  const missing=harness();missing.render();missing.requests[0].reject(new missing.ApiError('not found',404));await flush();assert(missing.render().error.includes('original receipt file is missing'));missing.unmount();
});
test('optional missing attachments do not fetch a nonexistent receipt or retain an earlier URL',async()=>{
  const h=harness();assert.equal(h.render('cash',false).status,'none');assert.equal(h.requests.length,0);
  h.render('cash',true);h.requests[0].resolve({size:128,type:'image/png'});await flush();assert.equal(h.render('cash',true).status,'ready');
  assert.equal(h.render('cash',false).status,'none');assert.equal(h.render('cash',false).url,undefined);assert.deepEqual(h.revoked,['blob:receipt-1']);h.unmount();
});

const previewCode=buildSync({entryPoints:[path.join(__dirname,'../src/features/payments/components/PaymentReceiptPreview.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react/jsx-runtime']}).outputFiles[0].text;
function preview(state){
  const module={exports:{}};const jsx=(type,props)=>({type,props});
  vm.runInNewContext(previewCode,{module,exports:module.exports,require:id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:{usePaymentReceipt:()=>state}});
  return module.exports.default({fileName:'receipt.pdf',receipt:state});
}
function find(node,type){if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,type);if(result)return result;}return null;}
test('ready PDF/image receipts render inline and retain a safe optional full-size link',()=>{
  const pdf=preview({status:'ready',kind:'pdf',url:'blob:one'});assert.equal(find(pdf,'iframe').props.src,'blob:one#navpanes=0&view=FitH');assert(find(pdf,'iframe').props.title.includes('receipt.pdf'));assert.equal(find(pdf,'a').props.rel,'noopener noreferrer');
  assert.equal(find(pdf,'span').props.children,'File loaded');
  const image=preview({status:'ready',kind:'image',url:'blob:two'});assert.equal(find(image,'img').props.src,'blob:two');assert(find(image,'img').props.alt.includes('receipt.pdf'));assert.equal(find(image,'iframe'),null);
  const failed=preview({status:'error',error:'offline'});assert.equal(find(failed,'iframe'),null);assert.equal(find(failed,'button').props.children,'Retry preview');
  assert.equal(find(failed,'span').props.children,'Unavailable');
});

test('receipt transport retains admin authentication and passes cancellation without URL credentials',async()=>{
  const result=buildSync({stdin:{contents:"export {downloadAdminPaymentReceipt} from './src/features/payments/api/manualPayments';",resolveDir:path.join(__dirname,'..'),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env':'{}'}});
  const loaded=new Module(__filename,module);loaded.paths=module.paths;loaded._compile(result.outputFiles[0].text,__filename);
  const original=global.fetch;let call;
  global.fetch=async(url,init)=>{call={url,init};return new Response(new Blob(['receipt'],{type:'application/pdf'}));};
  try{
    const controller=new AbortController();
    const blob=await loaded.exports.downloadAdminPaymentReceipt('submission-id',controller.signal);
    assert.equal(blob.type,'application/pdf');assert(call.url.endsWith('/api/admin/payments/manual-payments/submission-id/receipt'));
    assert(!call.url.includes('token'));assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.signal,controller.signal);
    assert.equal(call.init.headers,undefined);
  }finally{global.fetch=original;}
});
