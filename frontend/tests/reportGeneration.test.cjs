const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { exampleReport } = require('./studentReportFixtures.cjs');
const code = buildSync({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
export * from './src/features/report-review/reportGeneration';
import {ReportGenerationDialog} from './src/features/report-review/ReportGenerationDialog';
export const renderProgress = progress => renderToStaticMarkup(React.createElement(ReportGenerationDialog,{progress,onDismiss:()=>{}}));`,
resolveDir: path.join(__dirname,'..'), loader:'tsx' }, bundle:true, platform:'node', format:'cjs', jsx:'automatic', write:false,
loader:{'.css':'empty'}, define:{'import.meta.env':'{}'}, external:['react','react-dom','react-dom/server','react/jsx-runtime'] }).outputFiles[0].text;
const compiled = new Module(__filename,module);compiled.paths=module.paths;compiled._compile(code,__filename);
const { generateReportDrafts, renderProgress } = compiled.exports;

test('generation progress follows saved responses with the latest version, without mutating old snapshots', async()=>{
 const report=exampleReport(), progress=[], versions=[], saved=[];
 const result=await generateReportDrafts(report,report.document.sections,async(current,topic)=>{
   versions.push(current.version);return {...current,version:current.version+1};
 },p=>progress.push(p),(r,t)=>saved.push(t),()=>assert.fail('No failures expected'));
 assert.deepEqual(versions,[1,2,3,4]);assert.equal(result.version,5);
 assert(progress[0].items.every(i=>i.state==='queued'));
 assert.equal(progress[1].items[0].state,'generating');
 assert.equal(progress[2].items[0].state,'saved');
 assert(progress.at(-1).items.every(i=>i.state==='saved'));
 assert(progress.at(-1).finishedAt!==null);assert.equal(saved.length,4);
});
test('a pending request does not advance completed progress',async()=>{
 const report=exampleReport();let release;let latest;
 const pending=generateReportDrafts(report,[report.document.sections[0]],()=>new Promise(resolve=>release=resolve),p=>latest=p,()=>{},()=>{});
 assert.equal(latest.items[0].state,'generating');assert.equal(latest.finishedAt,null);
 release({...report,version:2});await pending;
 assert.equal(latest.items[0].state,'saved');assert(latest.finishedAt!==null);
});
test('partial failure remains visible and other sections continue without advancing the failed version',async()=>{
 const report=exampleReport(), versions=[], failed=[], saved=[];let result;
 await generateReportDrafts(report,report.document.sections,async(current,topic)=>{
  versions.push(current.version);if(topic==='PAYMENTS')throw Error('Request timed out');return {...current,version:current.version+1};
 },p=>result=p,(r,t)=>saved.push(t),(t,message)=>failed.push([t,message]));
 assert.deepEqual(versions,[1,2,2,3]);assert.equal(saved.length,3);
 assert.deepEqual(failed,[['PAYMENTS','Request timed out']]);assert.equal(result.items[1].state,'failed');
 assert(result.finishedAt!==null);
 const html=renderProgress(result);assert(html.includes('Some drafts need attention'));assert(html.includes('3 saved'));
 assert(html.includes('1 could not be confirmed'));assert(html.includes('Back to editor'));assert(!html.includes('Drafts ready to review'));
});
test('unmount prevents subsequent requests and progress callbacks',async()=>{
 const report=exampleReport();let mounted=true, release, calls=0, callbacks=0;
 const pending=generateReportDrafts(report,report.document.sections,()=>{calls++;return new Promise(resolve=>release=resolve);},()=>callbacks++,()=>assert.fail('Unmounted'),()=>assert.fail('Unmounted'),()=>mounted);
 mounted=false;const before=callbacks;release(report);await pending;
 assert.equal(calls,1);assert.equal(callbacks,before);
});
test('running dialog exposes an accessible real progress bar and no premature review action',()=>{
 const html=renderProgress({startedAt:Date.now(),finishedAt:null,items:[
  {topic:'ATTENDANCE',title:'Attendance',state:'saved'}, {topic:'PAYMENTS',title:'Payments',state:'generating'},
  {topic:'LEARNING',title:'Teacher feedback',state:'queued'}]});
 for(const text of ['Generating Payments','1 of 3 saved','33%','value="1"','max="3"','role="status"','Saved','Queued','Elapsed'])assert(html.includes(text),text);
 assert(!html.includes('Review drafts</button>'));
});
test('all-success shows 100% without a manual confirmation button; failure never claims 100%',()=>{
 const items=[{topic:'ATTENDANCE',title:'Attendance',state:'saved'},{topic:'PAYMENTS',title:'Payments',state:'saved'}];
 const success=renderProgress({startedAt:Date.now(),finishedAt:Date.now(),items});
 assert(success.includes('100%'));assert(success.includes('Returning to your report'));assert(!success.includes('Review drafts</button>'));
 assert(!success.includes('modal__foot'));
 const failure=renderProgress({startedAt:Date.now(),finishedAt:Date.now(),items:[items[0],{...items[1],state:'failed'}]});
 assert(failure.includes('50%'));assert(!failure.includes('100%'));assert(failure.includes('Back to editor'));
});

test('successful completion auto-dismisses once after 650ms, uses latest callback, and cleans up',()=>{
 const vm=require('node:vm');
 const hookCode=buildSync({entryPoints:[path.join(__dirname,'../src/features/report-review/useGenerationAutoDismiss.ts')],bundle:true,platform:'node',format:'cjs',write:false,external:['react']}).outputFiles[0].text;
 const timers=new Map();let nextId=0,cleanup,lastComplete,ref;
 const fakeReact={useRef:initial=>ref??(ref={current:initial}),useEffect:(effect,deps)=>{if(deps[0]===lastComplete)return;cleanup?.();lastComplete=deps[0];cleanup=effect();}};
 const stub={exports:{}};vm.runInNewContext(hookCode,{module:stub,exports:stub.exports,require:()=>fakeReact,window:{setTimeout:(fn,ms)=>{assert.equal(ms,650);timers.set(++nextId,fn);return nextId;},clearTimeout:id=>timers.delete(id)}});
 let oldCalls=0,newCalls=0;const render=stub.exports.useGenerationAutoDismiss;
 render(false,()=>oldCalls++);assert.equal(timers.size,0);
 render(true,()=>oldCalls++);assert.equal(timers.size,1);
 render(true,()=>newCalls++);assert.equal(nextId,1,'rerender must not restart timer');
 timers.values().next().value();assert.equal(oldCalls,0);assert.equal(newCalls,1);
 cleanup();assert.equal(timers.size,0);
 render(false,()=>newCalls++);assert.equal(timers.size,0,'running or failed state does not dismiss');
 render(true,()=>newCalls++);assert.equal(timers.size,1);cleanup();assert.equal(timers.size,0,'unmount clears timer');
});
