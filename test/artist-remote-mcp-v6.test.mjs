import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteBridge} from '../src/mcp/http-bridge.mjs';

const token='testing-secret-with-long-entropy-not-for-production';
async function setup(fn){
 const handler=async(name,args)=>{
  if(name==='paint_preview')return {content:[{type:'image',mimeType:'image/png',data:'iVBORw0KGgo='}]};
  if(name==='paint_apply')return {content:[{type:'text',text:JSON.stringify({accepted:true,asset_id:args.asset_id})}]};
  return {content:[{type:'text',text:'ok'}]};
 };
 const tools=[
  {name:'paint_preview',description:'Read preview',inputSchema:{type:'object',properties:{asset_id:{type:'string'}},required:['asset_id']}},
  {name:'paint_apply',description:'Commit brush edit',inputSchema:{type:'object',properties:{asset_id:{type:'string'}},required:['asset_id']}}
 ];
 const server=createRemoteBridge({token,tools,callTool:handler,allowedOrigins:['https://chatgpt.com']});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/mcp';
 async function post(body,{bearer=token,origin=null,method='POST',headers={}}={}){
  return fetch(url,{method,headers:{
   'content-type':'application/json','accept':'application/json, text/event-stream',
   ...(bearer===null?{}:{authorization:'Bearer '+bearer}),
   ...(origin?{origin}:{}),...headers},
   ...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
 }
 try{await fn({url,post});}finally{await new Promise(resolve=>server.close(resolve))}
}
const rpc=(method,id=1,params={})=>({jsonrpc:'2.0',id,method,params});
test('requires bearer for all MCP discovery and actions; rejects wrong credentials',async()=>setup(async({post})=>{
 for(const bearer of [null,'wrong','']){const r=await post(rpc('tools/list'),{bearer});assert.equal(r.status,401);}
 const r=await post(rpc('tools/list'));assert.equal(r.status,200);const b=await r.json();assert.equal(b.result.tools.length,2);
}));
test('initializes MCP, lists tools, invokes image and modifies only exact allowed tool',async()=>setup(async({post})=>{
 const hello=await post(rpc('initialize',1,{protocolVersion:'2025-11-25'}));
 assert.equal(hello.status,200);assert.equal((await hello.json()).result.serverInfo.name,'game-artist-remote-mcp');
 const image=await post(rpc('tools/call',2,{name:'paint_preview',arguments:{asset_id:'lantern'}}));
 assert.equal((await image.json()).result.content[0].type,'image');
 const edit=await post(rpc('tools/call',3,{name:'paint_apply',arguments:{asset_id:'lantern'}}));
 assert.equal(JSON.parse((await edit.json()).result.content[0].text).accepted,true);
 const shell=await post(rpc('tools/call',4,{name:'shell_exec',arguments:{command:'echo forbidden'}}));
 assert.equal((await shell.json()).error.code,-32602);
}));
test('denies arbitrary cross-origin calls, no unauthenticated CORS reflection',async()=>setup(async({post,url})=>{
 const request=await post(rpc('tools/list'),{origin:'https://evil.example'});
 assert.equal(request.status,403);
 const request2=await post(rpc('tools/list'),{origin:'https://chatgpt.com'});
 assert.equal(request2.status,200);
 assert.equal(request2.headers.get('access-control-allow-origin'),null);
 const get=await fetch(url);assert.equal(get.status,401);
}));
test('rejects JSON duplicate keys, invalid envelopes, oversized payload and method confusion',async()=>setup(async({post})=>{
 const dup=await post('{"jsonrpc":"2.0","id":1,"method":"ping","method":"tools/list"}');
 assert.equal(dup.status,400);
 const tooLong=await post(JSON.stringify(rpc('ping',1,{blob:'0'.repeat(300000)})));
 assert.equal(tooLong.status,413);
 const bad=await post({jsonrpc:'2.0',id:1,method:'notifications/initialized'});
 assert.equal(bad.status,200);
 const old=await post(rpc('initialize',2,{protocolVersion:'2000-01-01'}));
 assert.equal((await old.json()).error.code,-32602);
 const noAccept=await post(rpc('tools/list'),{headers:{accept:'application/json'}});
 assert.equal(noAccept.status,406);
}));
test('refuses insecure default exposure or low entropy token',()=>{
 assert.throws(()=>createRemoteBridge({token:'short',tools:[],callTool:()=>{}}),/REMOTE_MCP_REJECTED/);
 assert.throws(()=>createRemoteBridge({token:null,tools:[],callTool:()=>{}}),/REMOTE_MCP_REJECTED/);
});

test('supports commonly deployed compatible MCP protocol versions without losing authorization',async()=>setup(async({post})=>{
 for(const version of ['2025-03-26','2025-06-18','2025-11-25']){
  const r=await post(rpc('initialize',8,{protocolVersion:version}));
  assert.equal((await r.json()).result.protocolVersion,version);
 }
}));
