const test=require('node:test');const assert=require('node:assert/strict');
const path=require('node:path');const vm=require('node:vm');const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:[path.join(__dirname,'../src/components/ExportShareModal.tsx')],bundle:true,write:false,
  platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','./Modal','../lib/feedbackSummaryApi'],define:{'import.meta.env':'{}'}}).outputFiles[0].text;
function find(node,type){if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,type);if(result)return result;}return null;}
test('legacy delivery retains uncertain outcomes instead of closing with a success message',async()=>{
  for(const status of ['SENT','DEMO','UNKNOWN','UNRECOGNIZED']) {
    let cursor=0,closed=0,updated=0;const values=[],toasts=[];
    const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],next=>values[i]=next];}};
    const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
    const module={exports:{}};
    vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?runtime:id==='./Modal'?function Modal(){}:id==='../lib/feedbackSummaryApi'?{emailFeedbackSummary:async()=>({status}),publishFeedbackSummary:async()=>({})}:require(id),window:{setTimeout(){}}});
    const render=()=>{cursor=0;return module.exports.default({summaries:[{id:'reviewed'}],onClose(){closed++;},onUpdated(){updated++;},showToast:text=>toasts.push(text)});};
    let modal=render();const labels=modal.props.children.props.children.filter(child=>child?.type==='label');
    find(labels[1],'input').props.onChange({target:{checked:true}});
    modal=render();modal.props.footer.props.children[1].props.onClick();
    for(let i=0;i<12;i++)await Promise.resolve();
    assert.equal(updated,1);
    if(status==='SENT'||status==='DEMO'){assert.equal(closed,1);assert.equal(toasts.length,1);}
    else {assert.equal(closed,0);assert.equal(toasts.length,0);assert(JSON.stringify(render()).includes('will not be sent again automatically'));}
  }
});
