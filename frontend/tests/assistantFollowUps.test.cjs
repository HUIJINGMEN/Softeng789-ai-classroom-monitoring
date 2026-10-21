const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const compiled = buildSync({ entryPoints: [path.join(__dirname, '../src/features/admin-assistant/assistantSuggestions.ts')], bundle:true, platform:'node', format:'cjs', write:false });
const loaded = new Module(__filename, module);
loaded._compile(compiled.outputFiles[0].text, __filename);
const { assistantFollowUps } = loaded.exports;
const answer = () => ({status:'ANSWER',intent:'ATTENDANCE',language:'zh',context:{studentId:'ana',studentName:'Ana',intent:'ATTENDANCE',courseQuery:'INFOSYS 222',dateFrom:'2026-10-05',dateTo:'2026-10-05'}});
test('follow-ups retain the chosen student while cross-topic questions clear the old course', () => {
  const data = answer();const actions = assistantFollowUps(data);
  assert.equal(actions.length,3);assert(actions.every(action => action.context.studentId === 'ana'));
  assert.equal(actions[0].context.courseQuery,'INFOSYS 222');
  assert.equal(actions.find(action => action.label === '当前付款状态').context.courseQuery,'');
  assert.equal(data.context.courseQuery,'INFOSYS 222');assert(actions.every(action => action.message.includes('该学生')));
});
test('no guessed student or ambiguous choice gets scoped follow-ups', () => {
  assert.deepEqual(assistantFollowUps({...answer(),status:'CLARIFY'}),[]);
  assert.deepEqual(assistantFollowUps({...answer(),context:{...answer().context,studentId:null}}),[]);
});
test('unsupported requests offer explicit global read queries without retaining a previous student', () => {
  const actions=assistantFollowUps({...answer(),status:'UNSUPPORTED'});
  assert.equal(actions.length,3);assert(actions.every(action=>action.context===null));
  assert(actions.some(action=>action.message==='查询当前未付账单'));
  assert(actions.every(action=>!action.message.includes('该学生')));
});
test('payment and schedule responses suggest useful other topics in the answer language', () => {
  for(const intent of ['PAYMENTS','PAYMENT_REVIEW']) {
    const actions=assistantFollowUps({...answer(),intent,language:'en'});
    assert.equal(actions.length,2);assert.equal(actions[0].label,"Today's attendance");assert(!actions.some(action=>action.label==='Current payments'));
  }
  assert(assistantFollowUps({...answer(),intent:'SCHEDULE',language:'en'}).some(action=>action.label==='Current payments'));
});
