const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const {buildSync} = require('esbuild');
const compiled = buildSync({entryPoints:[path.join(__dirname,'../src/features/admin-assistant/assistantScroll.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const loaded = new Module(__filename,module);loaded._compile(compiled.outputFiles[0].text,__filename);
test('completed replies reveal the summary in their own scroll region, not the surrounding page',()=>{
  const region={scrollTop:600,getBoundingClientRect:()=>({top:100})};
  loaded.exports.revealAssistantReply(region,{getBoundingClientRect:()=>({top:-200})});
  assert.equal(region.scrollTop,280);
});
test('first replies never request negative scroll and below-viewport targets move into view',()=>{
  const region={scrollTop:0,getBoundingClientRect:()=>({top:100})};
  loaded.exports.revealAssistantReply(region,{getBoundingClientRect:()=>({top:110})});assert.equal(region.scrollTop,0);
  loaded.exports.revealAssistantReply(region,{getBoundingClientRect:()=>({top:700})});assert.equal(region.scrollTop,580);
});
