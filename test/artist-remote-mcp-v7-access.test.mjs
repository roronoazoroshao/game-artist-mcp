import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteBridge} from '../src/mcp/http-bridge.mjs';

const writer='writer-credential-0123456789abcdefghij';
const reader='reader-credential-9876543210abcdefghij';
const tools=[
 {name:'asset_get',description:'Read asset',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{asset_id:{type:'string'}}}},
 {name:'paint_apply',description:'Write asset',annotations:{readOnlyHint:false},inputSchema:{type:'object',properties:{asset_id:{type:'string'}}}},
 {name:'art_game_capture',description:'Expensive actual game capture',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{frame:{type:'integer'}}}}
];
const rpc=(method,params,id=1)=>({jsonrpc:'2.0',id,method,params});
async function withGateway(fn,options={}){
 const events=[],invocations=[];
 const server=createRemoteBridge({token:writer,readOnlyToken:reader,readOnlyToolNames:['asset_get','art_game_capture'],
  tools,callTool:async(name,args)=>{invocations.push(name);return {content:[{type:'text',text:'ok'}]};},
  onAudit:(record)=>events.push(record),allowedOrigins:['https://chatgpt.com'],
  ...options});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/mcp';
 const post=async(method,params,{bearer=writer,id=1}={})=>{
  const result=await fetch(url,{method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream',authorization:'Bearer '+bearer},
   body:JSON.stringify(rpc(method,params,id))});
  return {status:result.status,body:await result.json()};
 };
 try{await fn({post,events,invocations})}finally{await new Promise(resolve=>server.close(resolve))}
}
test('read-only credential sees only read tools and cannot execute a write even if name is known',async()=>withGateway(async({post,invocations})=>{
 const view=await post('tools/list',{}, {bearer:reader});
 assert.deepEqual(view.body.result.tools.map(x=>x.name),['asset_get','art_game_capture']);
 const denied=await post('tools/call',{name:'paint_apply',arguments:{asset_id:'a'}},{bearer:reader});
 assert.equal(denied.body.error.code,-32602);
 const permitted=await post('tools/call',{name:'asset_get',arguments:{asset_id:'a'}},{bearer:reader});
 assert.equal(permitted.status,200);
 assert.deepEqual(invocations,['asset_get']);
 const full=await post('tools/list',{});
 assert.equal(full.body.result.tools.length,3);
}));
test('read and write tokens do not accidentally alias each other',async()=>withGateway(async({post})=>{
 const wrong=await post('tools/list',{}, {bearer:'unknown-credential-0123456789abcdef'});
 assert.equal(wrong.status,401);
 const ok=await post('tools/list',{}, {bearer:reader});
 assert.equal(ok.status,200);
}));
test('global per-process tool quota stops repeated low-cost calls at a bounded threshold',async()=>withGateway(async({post,invocations})=>{
 for(let i=0;i<2;i++)assert.equal((await post('tools/call',{name:'asset_get',arguments:{asset_id:'a'}},{id:i+1})).status,200);
 const busy=await post('tools/call',{name:'asset_get',arguments:{asset_id:'a'}},{id:4});
 assert.equal(busy.status,429);
 assert.equal(invocations.length,2);
},{maxCallsPerMinute:2,maxHeavyPerMinute:2}));
test('heavy game captures use stricter per-process budget; denied request never reaches Godot',async()=>withGateway(async({post,invocations})=>{
 const one=await post('tools/call',{name:'art_game_capture',arguments:{frame:0}});
 assert.equal(one.status,200);
 const two=await post('tools/call',{name:'art_game_capture',arguments:{frame:0}},{id:2});
 assert.equal(two.status,429);
 assert.deepEqual(invocations,['art_game_capture']);
},{maxCallsPerMinute:10,maxHeavyPerMinute:1,heavyToolNames:['art_game_capture']}));
test('audit events record only action, authorization scope and status, never bearer or raw asset data',async()=>withGateway(async({post,events})=>{
 await post('tools/call',{name:'paint_apply',arguments:{asset_id:'PRIVATE_ART_ASSET_NAME'}},{bearer:writer});
 await post('tools/call',{name:'asset_get',arguments:{asset_id:'PRIVATE_ART_ASSET_NAME'}},{bearer:reader});
 assert.equal(events.length,2);
 const raw=JSON.stringify(events);
 assert.ok(!raw.includes(writer));
 assert.ok(!raw.includes(reader));
 assert.ok(!raw.includes('PRIVATE_ART_ASSET_NAME'));
 assert.equal(events[0].scope,'write');
 assert.equal(events[1].scope,'read');
 assert.deepEqual(events.map(x=>x.tool),['paint_apply','asset_get']);
}));
test('misconfigured readonly scope is rejected rather than exposing writer via mislabelled tool',()=>{
 assert.throws(()=>createRemoteBridge({token:writer,readOnlyToken:reader,readOnlyToolNames:['paint_apply'],
  tools,callTool:()=>{}}),/REMOTE_MCP_REJECTED/);
 assert.throws(()=>createRemoteBridge({token:writer,readOnlyToken:writer,readOnlyToolNames:['asset_get'],
  tools,callTool:()=>{}}),/REMOTE_MCP_REJECTED/);
});
