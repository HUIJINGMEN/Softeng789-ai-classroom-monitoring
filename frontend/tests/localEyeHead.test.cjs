const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const code = buildSync({entryPoints:[path.join(__dirname,'../src/features/webcam-events/eyeHeadModel.ts')],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;
const moduleValue={exports:{}};vm.runInNewContext(code,{module:moduleValue,exports:moduleValue.exports});
const {EyeHeadObserver,LOCAL_LIMITS}=moduleValue.exports;
function matrix(pitch=0,yaw=0,roll=0){
  const p=pitch*Math.PI/180,y=yaw*Math.PI/180,r=roll*Math.PI/180;
  return [Math.cos(r),Math.sin(r),0,0,0,Math.cos(p),Math.sin(p),0,Math.sin(y)*Math.cos(p),-Math.sin(p),Math.cos(y)*Math.cos(p),0,0,0,0,1];
}
function frame(at,options={}) {const {left=.3,right=.3,pitch=0,yaw=0,roll=0,reason=null,...rest}=options;return {type:'result',timestamp:at,count:1,boxes:[],matrix:matrix(pitch,yaw,roll),localEyes:{left,right,reason},inferenceMs:10,...rest};}
function calibrated(){const m=new EyeHeadObserver();m.calibrate();for(let t=0;t<=2000;t+=250)m.update(frame(t));assert(m.current().calibrated);return m;}
function feed(m,start,end,options){let view;for(let t=start;t<=end;t+=250)view=m.update(frame(t,options));return view;}

test('requires explicit stable open-eye calibration; closed eyes and unstable posture cannot set a baseline',()=>{
 const m=new EyeHeadObserver();assert(!m.update(frame(0)).calibrated);m.calibrate();
 assert(!feed(m,250,3250,{left:.05,right:.05}).calibrated);
 assert(!feed(m,3500,4500,{}).calibrated);assert(!m.update(frame(4750,{pitch:12})).calibrated);
 assert(!m.update(frame(5000,{left:.2})).calibrated);
 assert(feed(m,5250,7500,{}).calibrated);
});
test('brief blink is not retained; bilateral closure needs continuous 2 seconds and emits once',()=>{
 const m=calibrated();feed(m,2250,2500,{left:.05,right:.05});m.update(frame(2750));assert.equal(m.current().events.length,0);
 const view=feed(m,3000,5500,{left:.05,right:.05});assert.equal(view.eyes.status,'sustained');assert.equal(view.eyes.durationMs,2500);
 assert.equal(view.events.length,1);assert.equal(view.events[0].kind,'EYES_CLOSED');
 m.update(frame(5750));assert.equal(m.current().eyes.durationMs,0);
});
test('one-eye closure and ambiguous aperture are unavailable rather than closed',()=>{
 const m=calibrated();let v=feed(m,2250,5250,{left:.05,right:.3});assert.equal(v.eyes.status,'unavailable');assert.equal(v.events.length,0);
 v=feed(m,5500,8500,{left:.2,right:.2});assert.equal(v.eyes.status,'unavailable');assert.equal(v.events.length,0);
});
test('head lowering is directional, relative to calibration and requires 3 seconds',()=>{
 const m=calibrated();let v=feed(m,2250,6250,{pitch:-25});assert.equal(v.head.status,'clear');assert.equal(v.events.length,0);
 v=feed(m,6500,9250,{pitch:20});assert.equal(v.head.status,'pending');
 v=m.update(frame(9500,{pitch:20}));assert.equal(v.head.status,'sustained');assert.equal(v.events[0].kind,'HEAD_LOWERED');
});
test('eye and head durations can run independently and neither is a combined sleep score',()=>{
 const m=calibrated();const v=feed(m,2250,5500,{left:.05,right:.05,pitch:16});
 assert.equal(v.events.length,2);assert.equal(v.eyes.status,'sustained');assert.equal(v.head.status,'sustained');
 assert(v.events.every(e=>['EYES_CLOSED','HEAD_LOWERED'].includes(e.kind)));
});
test('large turns, missing faces, multiple faces, lighting and malformed geometry reset durations',()=>{
 for(const bad of [{count:0},{count:2},{reason:'Lighting or image contrast is insufficient'},{matrix:null},{localEyes:null},{left:NaN},{left:-1},{left:2},{yaw:50}]){
  const m=calibrated();feed(m,2250,3750,{left:.05,right:.05});const v=m.update(frame(4000,bad));
  assert.equal(v.eyes.status,'unavailable');assert.equal(v.eyes.durationMs,0);
  assert.equal(feed(m,4250,5750,{left:.05,right:.05}).events.length,0);
 }
});
test('unavailable, hidden or missing samples never bridge continuous time',()=>{
 const m=calibrated();feed(m,2250,3750,{left:.05,right:.05});m.pause();
 assert.equal(feed(m,4000,5500,{left:.05,right:.05}).events.length,0);
 let v=m.update(frame(10000,{left:.05,right:.05}));assert.equal(v.eyes.durationMs,0);assert.equal(v.events.length,0);
 v=m.update(frame(9000,{left:.05,right:.05}));assert.equal(v.eyes.status,'unavailable');
 v=m.update(frame(NaN));assert.equal(v.eyes.status,'unavailable');
});
test('a gap or blink during calibration restarts the required stable interval',()=>{
 const m=new EyeHeadObserver();m.calibrate();feed(m,0,1250,{});assert(!m.update(frame(3000)).calibrated);
 assert(!feed(m,3250,4000,{}).calibrated);m.update(frame(4250,{left:.05,right:.05}));assert(!feed(m,4500,6250,{}).calibrated);
 assert(m.update(frame(6500)).calibrated);
});
test('local history is bounded and recalibration clears it',()=>{
 const m=calibrated();let t=2250;
 for(let n=0;n<25;n++){feed(m,t,t+2250,{left:.05,right:.05});t+=2500;m.update(frame(t));t+=250;}
 assert.equal(m.current().events.length,LOCAL_LIMITS.history);m.clearHistory();assert.equal(m.current().events.length,0);
 m.calibrate();assert(!m.current().calibrated);assert.equal(m.current().eyes.durationMs,0);
});

const geometry={};vm.createContext(geometry);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/webcam-local-signals.js'),'utf8'),geometry);
function landmarks(width=640,height=480){
 const points=Array.from({length:478},()=>({x:.5,y:.5}));
 for(const [ids,x] of [[[33,133,160,144,158,153],.3],[[362,263,385,380,387,373],.6]]){
  const px=[[x,.4],[x+.06,.4],[x+.02,.4-.012],[x+.02,.4+.012],[x+.04,.4-.012],[x+.04,.4+.012]];
  ids.forEach((id,i)=>points[id]={x:px[i][0]*640/width,y:px[i][1]*480/height});
 }
 return points;
}
test('eye geometry uses pixel distances, yielding the same ratio across image aspect ratios',()=>{
 const a=geometry.measureLocalFace(landmarks(),640,480,{mean:100,contrast:20});
 const b=geometry.measureLocalFace(landmarks(800,600),800,600,{mean:100,contrast:20});
 assert.equal(a.reason,null);assert(Math.abs(a.left-.3)<1e-8);assert(Math.abs(a.left-b.left)<1e-8);
});
test('quality gate rejects dark, washed out, flat, too-small and off-frame measurements',()=>{
 for(const light of [null,{mean:10,contrast:20},{mean:250,contrast:20},{mean:100,contrast:2}])assert(geometry.measureLocalFace(landmarks(),640,480,light).reason);
 assert(geometry.measureLocalFace(landmarks(),100,100,{mean:100,contrast:20}).reason);
 const p=landmarks();p[160].x=-.2;assert(geometry.measureLocalFace(p,640,480,{mean:100,contrast:20}).reason);
 p[160].x=NaN;assert(geometry.measureLocalFace(p,640,480,{mean:100,contrast:20}).reason);
});

test('real worker contract emits compact local evidence without landmarks or blendshapes',async()=>{
 const messages=[],points=landmarks();let closed=false,options;
 const context={self:{location:{href:'http://localhost/webcam-worker.js'},postMessage:v=>messages.push(v)},URL,
  performance:{now:()=>10},importScripts:()=>{},measureLocalFace:geometry.measureLocalFace,
  OffscreenCanvas:class{getContext(){return {drawImage(){},getImageData(){return {data:Array.from({length:4096},(_,i)=>i%4===3?255:(Math.floor(i/4)%2?100:150))};}};}},
  Vision:{FilesetResolver:{forVisionTasks:async()=>({})},FaceLandmarker:{createFromOptions:async(_f,o)=>{options=o;return {detectForVideo:()=>({faceLandmarks:[points],facialTransformationMatrixes:[{data:matrix()}]})};}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/webcam-worker.js'),'utf8'),context);
 await context.self.onmessage({data:{type:'init'}});
 await context.self.onmessage({data:{type:'frame',timestamp:500,bitmap:{width:640,height:480,close(){closed=true;}}}});
 const result=messages.at(-1);assert.equal(result.type,'result');assert.equal(result.localEyes.reason,null);assert.equal(options.outputFaceBlendshapes,false);
 assert.equal(result.faceLandmarks,undefined);assert.equal(result.face_blendshapes,undefined);assert(closed);
});
