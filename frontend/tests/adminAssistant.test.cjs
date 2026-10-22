const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const { buildSync } = require('esbuild');
const output = buildSync({ stdin: { contents: "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {AssistantResponse} from './src/features/admin-assistant/AssistantResponse'; import {AssistantPanel} from './src/features/admin-assistant/AssistantPanel'; export const response=(turn,disabled=false)=>renderToStaticMarkup(React.createElement(AssistantResponse,{turn,disabled,onRepeat(){},onSource(){}})); export const panel=state=>renderToStaticMarkup(React.createElement(AssistantPanel,{state,onClose(){},onSource(){}})); export * from './src/features/admin-assistant/assistantModel'; export * from './src/features/admin-assistant/api';", resolveDir: path.join(__dirname, '..'), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: {'import.meta.env':'{}'}, external: ['react','react-dom','react-dom/server','react/jsx-runtime'] });
const loaded = new Module(__filename,module); loaded.paths = module.paths; loaded._compile(output.outputFiles[0].text,__filename);
const api = loaded.exports;
const answer = () => ({status:'ANSWER',message:'Attendance is not recorded. This is not an absence.',intent:'ATTENDANCE',language:'en',dateFrom:'2026-10-16',dateTo:'2026-10-16',asOf:'2026-10-15T12:30:00Z',provider:'QWEN:test',truncated:false,context:{},choices:[],rows:[{id:'row',title:'Example Student',subtitle:'TEST-001',status:'NOT_RECORDED',facts:[{label:'Course',value:'TEST 101'}],source:{type:'SESSION',id:'session-1'}}]});
test('assistant presents distinct attendance/payment states and accessible source records', () => {
  assert.equal(api.statusLabel('NOT_RECORDED','zh'),'未记录'); assert.equal(api.statusLabel('ABSENT','zh'),'缺勤');
  assert.notEqual(api.statusTone('NOT_RECORDED'),api.statusTone('ABSENT'));
  assert.equal(api.statusLabel('AWAITING_VERIFICATION','en'),'Awaiting verification');
  const html = api.response({id:1,question:{message:'Did they come?'},answer:answer()});
  for(const text of ['Example Student','TEST-001','Not recorded','not an absence','Open lesson record','Checked'])assert(html.includes(text),text);
  assert(!html.includes('QWEN:test')); assert(!html.includes('<script>'));
});
test('ambiguous identity is a choice, not an invented answer', () => {
  const data=answer();data.rows=[];data.status='CLARIFY';data.choices=[{id:'one',name:'Sam Lee',number:'S1'},{id:'two',name:'Sam Lee',number:'S2'}];
  const html=api.response({id:1,question:{message:'Sam?'},answer:data});
  assert(html.includes('Choose a student'));assert(html.includes('S1'));assert(html.includes('S2'));assert(!html.includes('Open lesson record'));
});
test('a missing student can be supplied inline without losing original dates', () => {
  const data=answer();data.status='CLARIFY';data.rows=[];data.choices=[];
  const html=api.response({id:1,question:{message:'Did a student attend on 16 Oct?'},answer:data});
  for(const text of ['Student name or number','Find &amp; continue','Keeps the original dates and course scope','2026-10-16','maxLength="120"'])assert(html.includes(text),text);
  assert(html.includes('aria-describedby'));assert(!html.includes('Open lesson record'));
});
test('source actions name their destination and ledger mismatches have an explicit check state', () => {
  assert.equal(api.sourceLabel({type:'PAYMENTS'},'en'),'Open payment account');
  assert.equal(api.sourceLabel({type:'STUDENT'},'zh'),'打开学生档案');
  assert.equal(api.statusLabel('STATUS_REVIEW','en'),'Check invoice status');
  assert.equal(api.statusTone('STATUS_REVIEW'),'pending');
});
test('error, limited results and payment snapshot cannot masquerade as full attendance answers', () => {
  const html=api.response({id:1,question:{message:'test'},error:'AI unavailable'});
  assert(html.includes('role="alert"'));assert(html.includes('Retry question'));
  const data=answer();data.intent='PAYMENTS';data.truncated=true;data.rows[0].title='<script>student</script>';
  const rendered=api.response({id:1,question:{message:'test'},answer:data});
  assert(rendered.includes('Results are limited'));assert(rendered.includes('Current payment snapshot'));assert(rendered.includes('&lt;script&gt;student'));assert(!rendered.includes('<script>'));
});
test('empty conversation has useful questions, labelled input and no automatic query', () => {
  let sends=0;
  const state={turns:[],draft:'',busyId:null,elapsed:0,send(){sends++},repeat(){},clear(){},setDraft(){}};
  const html=api.panel(state);
  for(const text of ['ClassLens Assistant','Read-only','Who was absent today?','Payments to verify','Ask the administrator assistant','Send question','New chat'])assert(html.includes(text),text);
  assert(html.includes('<dialog'));assert(html.includes('aria-labelledby'));assert.equal(sends,0);
  const shell=readFileSync(path.join(__dirname,'../src/pages/TeacherApp.tsx'),'utf8');
  assert(shell.includes('isAdmin && <AdminAssistant'));assert(shell.includes('key={user.id}'));
});
test('student counts disclose a current record snapshot, not a historical date range', () => {
  const data=answer();data.intent='STUDENT_COUNT';data.rows=[];data.message='9 approved students; counted once.';
  const html=api.response({id:1,question:{message:'how many students do we have'},answer:data});
  assert(html.includes('9 approved students'));assert(html.includes('Current student-record count'));
  assert(!html.includes('2026-10-16 — 2026-10-16'));
  data.language='zh';assert(api.response({id:1,question:{message:'学生总数'},answer:data}).includes('当前学生档案统计'));
});
test('question API carries authorization through the shared client and supports cancellation', async () => {
  const original=global.fetch;let call;
  global.fetch=async(url,init)=>{ if(url==='/api/auth/csrf') return Response.json({headerName:'X-CSRF-TOKEN',token:'test-csrf'});call={url,init};return Response.json(answer());};
  try{const controller=new AbortController();await api.askAssistant({message:'today?',history:[],context:null},controller.signal);
    assert(call.url.endsWith('/api/admin/assistant/ask'));assert.equal(call.init.method,'POST');assert.equal(call.init.signal,controller.signal);assert.deepEqual(JSON.parse(call.init.body),{message:'today?',history:[],context:null});
  }finally{global.fetch=original;}
  const history=Array.from({length:8},(_,i)=>({question:{message:'Question '+i}}));assert.deepEqual(api.recentQuestions(history),['Question 4','Question 5','Question 6','Question 7']);
});
