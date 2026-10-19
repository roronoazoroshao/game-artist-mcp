#!/usr/bin/env node
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'game-artist-remote-mcp-'));
const bearer=randomBytes(32).toString('base64url');
const server=spawn(process.execPath,['src/mcp/remote-server.mjs','--workspace',root],{
 cwd:process.cwd(),env:{...process.env,GAME_ARTIST_REMOTE_BIND:'127.0.0.1',
 GAME_ARTIST_REMOTE_PORT:'0',GAME_ARTIST_REMOTE_BEARER_TOKEN:bearer},stdio:['ignore','ignore','pipe']
});
let stderr='';
try{
 const listening=await new Promise((resolve,reject)=>{
  const guard=setTimeout(()=>reject(Error('MCP HTTP startup exceeded timeout: '+stderr)),10000);
  server.stderr.on('data',chunk=>{
   stderr+=chunk.toString();
   const match=stderr.match(/GAME_ARTIST_REMOTE_READY (\{[^\n]+\})/);
   if(match){clearTimeout(guard);resolve(JSON.parse(match[1]))}
  });
  server.on('exit',code=>{clearTimeout(guard);reject(Error('gateway exited '+code+': '+stderr))});
 });
 assert.equal(listening.hasTLS,false);
 const endpoint='http://127.0.0.1:'+listening.port+'/mcp';
 let id=0;
 const rpc=async(method,params={})=>{
  const res=await fetch(endpoint,{
   method:'POST',headers:{authorization:'Bearer '+bearer,accept:'application/json, text/event-stream',
    'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),
   signal:AbortSignal.timeout(50000)
  });
  assert.equal(res.status,200);
  const response=await res.json();
  assert.ok(response.result,JSON.stringify(response).slice(0,1300));
  assert.ok(!response.result.isError,JSON.stringify(response.result).slice(0,1300));
  return response.result;
 };
 const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'ChatGPT-remote-protocol-smoke',version:'1'}});
 assert.equal(init.serverInfo.name,'game-artist-remote-mcp');
 const listed=await rpc('tools/list');
 const names=listed.tools.map(t=>t.name);
 assert.ok(names.includes('art_quality_review_packet'));
 assert.ok(names.includes('art_game_capture'));
 assert.ok(names.includes('art_animation_audit'));
 assert.ok(names.includes('artist_session_reinspect'));
 assert.ok(names.includes('paint_scene_observe'));
 assert.ok(names.includes('paint_export'));
 assert.ok(!names.includes('shell_exec'));
 assert.ok(!names.includes('game_script'));
 assert.ok(!names.includes('document_apply_ops'));
 const use=async(name,args)=>rpc('tools/call',{name,arguments:args});
 const read=r=>JSON.parse(r.content[0].text);
 const created=read(await use('asset_create',{asset_id:'remote_lantern',width:64,height:64}));
 assert.equal(created.asset_id,'remote_lantern');
 read(await use('paint_open',{asset_id:'remote_lantern'}));
 const painted=read(await use('paint_apply',{asset_id:'remote_lantern',expected_revision:0,operations:[
  {type:'stroke.draw',layerId:'base',color:'#36dddd',radius:7,opacity:1,points:[[24,16,1],[31,36,1],[38,48,.7]]}
 ]}));
 assert.equal(painted.revision,1);
 const preview=await use('paint_preview',{asset_id:'remote_lantern',size:64});
 assert.ok(preview.content.some(x=>x.type==='image'));
 let actualVision='NOT_RUN';
 if(process.env.GAME_ARTIST_RUN_REAL_GODOT==='1'){
  const begun=read(await use('artist_session_begin',{asset_id:'remote_lantern',brief:'Improve the readability of remote spirit flame art',
   size:64,environment:'twilight',max_iterations:1}));
  assert.equal(begun.version,0);
  const observed=await use('artist_session_observe',{asset_id:'remote_lantern',expected_version:0});
  const first=read(observed);
  const recovered=await use('artist_session_reinspect',{asset_id:'remote_lantern',expected_version:1});
  assert.equal(read(recovered).observationSha256,first.observationSha256);
  assert.equal(recovered.content.find(x=>x.type==='image').data,observed.content.find(x=>x.type==='image').data);
  // No AI model critique is faked by this automated transport smoke.
  const finished=read(await use('artist_session_decide',{asset_id:'remote_lantern',expected_version:1,
   observation_sha256:first.observationSha256,decision:'FINISH',
   critique:'Transport verified. Real art direction requires ChatGPT vision, not protocol smoke.'}));
  assert.equal(finished.phase,'REVIEW_PENDING');
  actualVision='REAL_GODOT_PROTOCOL_OBSERVE_REINSPECT_PASS_NO_MODEL_JUDGMENT';
 }
 const unauthorized=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},
  body:JSON.stringify({jsonrpc:'2.0',id:123,method:'tools/list'})});
 assert.equal(unauthorized.status,401);
 console.log(JSON.stringify({status:'REMOTE_MCP_HTTP_PROTOCOL_PASS',toolCount:names.length,
  previewViaHttp:true,godotVision:actualVision,unauthorizedRejected:true,
  externalTLSConnected:false,chatgptUserAppConfigured:false}));
}finally{
 server.kill('SIGTERM');
 await new Promise(resolve=>{if(server.exitCode!==null||server.signalCode!==null)resolve();else{server.once('exit',resolve);setTimeout(resolve,3000).unref()}});
 await rm(root,{recursive:true,force:true});
}
