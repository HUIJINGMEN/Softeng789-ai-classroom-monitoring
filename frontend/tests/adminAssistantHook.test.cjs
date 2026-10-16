const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const vm=require('node:vm');
const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:[path.join(__dirname,'../src/features/admin-assistant/useAdminAssistant.ts')],bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'},external:['react','./api','../../lib/apiClient']}).outputFiles[0].text;
function harness(){
  const values=[],effects=[],requests=[],timers=new Map();let cursor=0,timerId=0;
  const react={
    useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},
    useRef:initial=>{const i=cursor++;return values[i]??(values[i]={current:initial});},
    useCallback:fn=>fn,
    useEffect:(effect,deps)=>{const i=cursor++;const before=effects[i];if(!before||deps.some((x,n)=>!Object.is(x,before.deps[n]))){before?.cleanup?.();effects[i]={deps,cleanup:effect()};}},
  };
  const api={askAssistant:(question,signal)=>new Promise((resolve,reject)=>requests.push({question,signal,resolve,reject}))};
  const window={setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++timerId,clearInterval(){}};
  const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='react'?react:id==='./api'?api:{apiMessage:e=>e.message},window,AbortController,Date});
  return{render:()=>{cursor=0;return module.exports.useAdminAssistant();},requests,timers,unmount:()=>effects.forEach(e=>e?.cleanup?.())};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

const panelHookCode = buildSync({entryPoints:[path.join(__dirname,'../src/features/admin-assistant/useAssistantPanel.ts')],bundle:true,write:false,platform:'node',format:'cjs',external:['react','./assistantScroll']}).outputFiles[0].text;
function panelHarness(state = {turns: [], busyId: null}, initialLock) {
  const refs=[],effects=[],listeners=new Map(),scrolls=[];
  class Element {
    isConnected=true;
    focuses=[];
    focus(options){this.focuses.push(options);}
  }
  const opener=new Element(), input=new Element(), clarification=new Element();
  const body={dataset: initialLock === undefined ? {} : {modalScrollLock: initialLock}};
  const document={activeElement:opener,body};
  const media={matches:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const panel={open:false,shows:0,modals:0,closes:0,clarifying:false,
    show(){this.open=true;this.shows++;},showModal(){this.open=true;this.modals++;},close(){this.open=false;this.closes++;},querySelector(){return this.clarifying?clarification:null;}};
  const mod={exports:{}};
  vm.runInNewContext(panelHookCode,{module:mod,exports:mod.exports,HTMLElement:Element,document,window:{matchMedia:()=>media},
    require:id=>id==='react'?{useId:()=> 'dialog-id',useRef:()=>{const ref={current:null};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn)}:{revealAssistantReply:(...args)=>scrolls.push(args)}});
  const hook=mod.exports.useAssistantPanel(state);
  hook.dialog.current=panel;hook.input.current=input;
  return {hook,panel,input,clarification,opener,body,document,media,listeners,scrolls,
    mount:()=>effects[0](),sync:()=>effects[1](),resize(mobile){media.matches=mobile;listeners.get('change')?.();}};
}
test('extracted panel lifecycle switches mobile modality and restores prior scroll locks and focus',()=>{
  for(const initial of [undefined,'existing-lock']){
    const h=panelHarness(undefined,initial);const cleanup=h.mount();
    assert.equal(h.panel.shows,1);assert.equal(h.body.dataset.modalScrollLock,initial);
    h.resize(true);assert.equal(h.panel.modals,1);assert.equal(h.body.dataset.modalScrollLock,'true');
    h.resize(false);assert.equal(h.body.dataset.modalScrollLock,initial);
    h.resize(true);cleanup();assert.equal(h.body.dataset.modalScrollLock,initial);
    assert.equal(h.listeners.size,0);assert.equal(h.panel.open,false);
    assert.equal(h.opener.focuses[0].preventScroll,true);
  }
});
test('panel focuses active clarification and reveals replies only inside its conversation region',()=>{
  const h=panelHarness({turns:[{id:1,answer:{status:'ANSWER'}}],busyId:null});
  h.panel.clarifying=true;const cleanup=h.mount();assert.equal(h.clarification.focuses.length,1);
  const region={},reply={};h.hook.conversation.current=region;h.hook.latestReply.current=reply;
  h.document.activeElement=h.body;h.sync();assert.equal(h.scrolls.length,1);
  assert.equal(h.scrolls[0][0],region);assert.equal(h.scrolls[0][1],reply);
  assert.equal(h.input.focuses[0].preventScroll,true);cleanup();
});
test('assistant serializes queries, carries verified context and preserves only four prior questions',async()=>{
  const h=harness();h.render().send('Did Ana attend?');h.render().send('duplicate');assert.equal(h.requests.length,1);
  const context={studentId:'ana',studentName:'Ana',intent:'ATTENDANCE'};h.requests[0].resolve({context,rows:[]});await flush();
  h.render().send('What about yesterday?');assert.equal(h.requests[1].question.context.studentId,'ana');assert.equal(h.requests[1].question.history[0],'Did Ana attend?');
  h.requests[1].resolve({context,rows:[]});await flush();assert.equal(h.render().turns.length,2);
  h.render().clear();assert.equal(h.render().turns.length,0);h.render().send('all lessons');assert.equal(h.requests[2].question.context,null);
  h.unmount();h.requests[2].resolve({context,rows:[]});await flush();
});
test('selection repeats the original scoped question and verifies only one in-flight request',async()=>{
  const h=harness();h.render().send('Sam today?');h.requests[0].resolve({context:null,choices:[{id:'second'}]});await flush();
  const turn=h.render().turns[0];h.render().repeat(turn,'second','Sam · S2');assert.equal(h.requests[1].question.message,'Sam today?');assert.equal(h.requests[1].question.selectedStudentId,'second');
  assert.equal(h.render().turns.length,1);assert.equal(h.render().turns[0].selection,'Sam · S2');
  h.requests[1].resolve({context:{studentId:'second'},rows:[]});await flush();assert.equal(h.render().busyId,null);
});
test('errors can retry and unmount cancels without restoring a private conversation',async()=>{
  const h=harness();h.render().send('question');h.requests[0].reject(new Error('offline'));await flush();assert.equal(h.render().turns[0].error,'offline');
  h.render().repeat(h.render().turns[0]);assert.equal(h.requests.length,2);h.unmount();assert.equal(h.requests[1].signal.aborted,true);
  h.requests[1].resolve({context:{studentId:'private'},rows:[]});await flush();assert.equal(h.render().turns[0].answer,undefined);
});
test('retry after a failed student selection retains that exact identity and label',async()=>{
  const h=harness();h.render().send('Sam today?');h.requests[0].resolve({context:null,choices:[{id:'second'}]});await flush();
  h.render().repeat(h.render().turns[0],'second','Sam · S2');h.requests[1].reject(new Error('offline'));await flush();
  h.render().repeat(h.render().turns[0]);assert.equal(h.requests[2].question.selectedStudentId,'second');
  assert.equal(h.render().turns[0].selection,'Sam · S2');h.unmount();h.requests[2].resolve({context:null});await flush();
});
test('one-click follow-up uses its answer scope rather than a different later student',async()=>{
  const h=harness();h.render().send('Ana today?');h.requests[0].resolve({context:{studentId:'ana'},rows:[]});await flush();
  h.render().send('Sam today?');h.requests[1].resolve({context:{studentId:'sam'},rows:[]});await flush();
  h.render().send('What is their current payment status?',{studentId:'ana',courseQuery:''});
  assert.equal(h.requests[2].question.context.studentId,'ana');assert.equal(h.requests[2].question.context.courseQuery,'');
  h.unmount();h.requests[2].resolve({context:null});await flush();
});
test('inline student clarification preserves the original question scope through failure and retry',async()=>{
  const h=harness();h.render().send('Did a student attend yesterday?');
  const context={intent:'ATTENDANCE',studentId:null,studentName:'',dateFrom:'2026-10-05',dateTo:'2026-10-05',courseQuery:'INFOSYS 222'};
  h.requests[0].resolve({status:'CLARIFY',context,choices:[]});await flush();
  h.render().resolveStudent(h.render().turns[0],' Ana Ngata ');
  assert.equal(h.requests[1].question.studentSearch,'Ana Ngata');assert.equal(h.requests[1].question.message,'Did a student attend yesterday?');
  assert.equal(h.requests[1].question.context.dateFrom,'2026-10-05');assert.equal(h.requests[1].question.context.courseQuery,'INFOSYS 222');
  h.requests[1].reject(new Error('offline'));await flush();h.render().repeat(h.render().turns[0]);
  assert.equal(h.requests[2].question.studentSearch,'Ana Ngata');assert.equal(h.requests[2].question.context.dateFrom,'2026-10-05');
  h.unmount();h.requests[2].resolve({context:null});await flush();
});
test('inline matching still needs an explicit choice for duplicate names and rejects invalid search text',async()=>{
  const h=harness();h.render().send('Which Sam attended?');
  const context={intent:'ATTENDANCE',studentId:null,studentName:'',dateFrom:'2026-10-05',dateTo:'2026-10-05',courseQuery:''};
  h.requests[0].resolve({status:'CLARIFY',context,choices:[{id:'two'}]});await flush();
  h.render().resolveStudent(h.render().turns[0],' ');h.render().resolveStudent(h.render().turns[0],'x'.repeat(121));assert.equal(h.requests.length,1);
  h.render().resolveStudent(h.render().turns[0],'Sam Lee','two','Sam Lee · S2');
  assert.equal(h.requests[1].question.selectedStudentId,'two');assert.equal(h.render().turns[0].selection,'Sam Lee · S2');
  h.unmount();h.requests[1].resolve({context:null});await flush();
});
