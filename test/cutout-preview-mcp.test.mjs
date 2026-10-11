import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const cutout=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
function fixture(){
 const doc=structuredClone(source),m=structuredClone(cutout);
 doc.nodes.push({id:'flame_alt_a',type:'ellipse',cx:120,cy:173,rx:9,ry:18,fill:'#72f5ec'});
 doc.nodes.push({id:'flame_alt_b',type:'ellipse',cx:133,cy:168,rx:10,ry:22,fill:'#b9fff4'});
 m.version=2;m.rendering={format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1};
 m.poseVariants=[{id:'flame_a',part:'flame',nodes:['flame_alt_a']},{id:'flame_b',part:'flame',nodes:['flame_alt_b']}];
 m.frameSequence={part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true};
 return {doc,m};
}
async function withServer(cb){
 const root=await mkdtemp(join(tmpdir(),'ga-frame-preview-'));
 const child=spawn(process.execPath,[resolve('src/mcp/server.mjs'),'--workspace',root],{stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',seq=0;const pending=new Map();
 child.stdout.on('data',data=>{
  stdout+=data.toString();
  while(stdout.includes('\n')){
   const n=stdout.indexOf('\n'),line=stdout.slice(0,n);stdout=stdout.slice(n+1);
   if(!line.trim())continue;
   const msg=JSON.parse(line),p=pending.get(msg.id);
   if(p){pending.delete(msg.id);p.resolve(msg)}
  }
 });
 child.stderr.on('data',x=>{stderr+=x.toString()});
 const call=(method,params)=>new Promise((resolveCall,reject)=>{
  const id=++seq,t=setTimeout(()=>reject(new Error('MCP timeout '+stderr)),15000);
  pending.set(id,{resolve:v=>{clearTimeout(t);resolveCall(v)}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
 });
 try{return await cb(call,root)}finally{child.kill('SIGTERM');await rm(root,{recursive:true,force:true})}
}
test('MCP render_cutout_preview emits actual pose-selected PNG bound to revision/clip/time',async()=>{
 const {doc,m}=fixture();
 await withServer(async call=>{
  await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'phase3',version:'1'}});
  const listed=await call('tools/list',{});
  assert.ok(listed.result.tools.some(t=>t.name==='render_cutout_preview'));
  assert.ok(!(await call('tools/call',{name:'asset_create',arguments:{asset_id:m.assetId,width:256,height:320}})).result.isError);
  const edit=await call('tools/call',{name:'document_apply_ops',arguments:{asset_id:m.assetId,expected_revision:0,operations:doc.nodes.map(node=>({type:'node.add',node}))}});
  assert.equal(edit.result.isError,undefined,JSON.stringify(edit.result));
  const args={asset_id:m.assetId,cutout:m,clip_id:'idle',time_seconds:0};
  const a=await call('tools/call',{name:'render_cutout_preview',arguments:args});
  const z=await call('tools/call',{name:'render_cutout_preview',arguments:{...args,time_seconds:1}});
  for(const msg of [a,z]){
   assert.equal(msg.result.isError,undefined,JSON.stringify(msg.result));
   const image=msg.result.content.find(x=>x.type==='image');
   assert.equal(image.mimeType,'image/png');
   const bytes=Buffer.from(image.data,'base64');
   assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
   assert.equal(msg.result.structuredContent.sha256,createHash('sha256').update(bytes).digest('hex'));
   assert.equal(msg.result.structuredContent.revision,1);
  }
  assert.equal(a.result.structuredContent.pose_ids.flame,'flame_a');
  assert.equal(z.result.structuredContent.pose_ids.flame,'flame_b');
  assert.notEqual(a.result.structuredContent.sha256,z.result.structuredContent.sha256);
  const old=await call('tools/call',{name:'render_preview',arguments:{asset_id:m.assetId}});
  assert.equal(old.result.isError,undefined);
  const state=await call('tools/call',{name:'asset_get',arguments:{asset_id:m.assetId}});
  assert.equal(JSON.parse(state.result.content[0].text).revision,1);
  for(const bad of [-1,999,2.1]){
   const denied=await call('tools/call',{name:'render_cutout_preview',arguments:{...args,time_seconds:bad}});
   assert.equal(denied.result.isError,true);
  }
 });
});
