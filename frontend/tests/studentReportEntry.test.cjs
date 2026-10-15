const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({entryPoints:[path.join(__dirname,'../src/features/student-reports/useStudentReportEntry.ts')],
  bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'},external:['react','./api']}).outputFiles[0].text;

function harness() {
  const values=[]; let cursor=0, cleanup, requestRef, effectRun=false, refreshes=0;
  const requests=[];
  const react = {
    useState: initial => {const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],next=>values[i]=next];},
    useRef: initial => requestRef ?? (requestRef={current:initial}),
    useEffect: effect => {if(!effectRun){cleanup=effect();effectRun=true;}},
  };
  const api = {getStudentReport:id=>new Promise((resolve,reject)=>requests.push({id,resolve,reject}))};
  const module = {exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='react'?react:api,Error});
  const render=()=>{cursor=0;return module.exports.useStudentReportEntry(()=>refreshes++);};
  return {render,requests,unmount:()=>cleanup(),refreshes:()=>refreshes};
}
const task={studentId:'student-1',name:'Example Student',courses:[]};
test('report opening ignores superseded responses and keeps the latest selection',async()=>{
  const h=harness();const state=h.render();
  const first=state.openSaved(task,{id:'first'});const second=state.openSaved(task,{id:'second'});
  h.requests[1].resolve({id:'second'});await second;
  h.requests[0].resolve({id:'first'});await first;
  assert.equal(h.render().active.report.id,'second');assert.equal(h.render().opening,'');
});
test('closing or unmounting invalidates pending report reads',async()=>{
  const h=harness();const pending=h.render().openSaved(task,{id:'old'});
  h.render().close();h.requests[0].resolve({id:'old'});await pending;
  assert.equal(h.render().active,null);assert.equal(h.refreshes(),1);
  const unmounted=h.render().openSaved(task,{id:'unmounted'});h.unmount();
  h.requests[1].resolve({id:'unmounted'});await unmounted;
  assert.equal(h.render().active,null);
});
test('opening failures are recoverable and starting another report clears the error',async()=>{
  const h=harness();const pending=h.render().openSaved(task,{id:'failed'});
  h.requests[0].reject(new Error('Could not open report'));await pending;
  assert.equal(h.render().error,'Could not open report');assert.equal(h.render().opening,'');
  h.render().start(task);assert.equal(h.render().error,'');assert.equal(h.render().active.task.name,task.name);
});
