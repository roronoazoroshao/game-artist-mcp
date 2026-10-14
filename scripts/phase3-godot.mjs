import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,rm,mkdtemp,cp,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const source=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/source.json'),'utf8'));
const cutout=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/cutout.json'),'utf8'));
const workspace=await mkdtemp(join(tmpdir(),'ga-phase3-godot-'));
const generated=join(root,'examples/spirit-lantern/generated/phase3-godot');
const child=spawn(process.execPath,[join(root,'src/mcp/server.mjs'),'--workspace',workspace],{stdio:['pipe','pipe','pipe']});
const pending=new Map();let buffer='',stderr='',next=0;
child.stdout.on('data',chunk=>{
 buffer+=chunk.toString();
 for(let n;(n=buffer.indexOf('\n'))>=0;){
  const line=buffer.slice(0,n);buffer=buffer.slice(n+1);
  if(!line.trim())continue;
  const msg=JSON.parse(line),waiting=pending.get(msg.id);
  if(waiting){pending.delete(msg.id);waiting.resolve(msg)}
 }
});
child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-8000)});
function request(method,params){
 const id=++next;
 return new Promise((resolveReq,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP '+method+' timed out: '+stderr))},30000);
  pending.set(id,{resolve:response=>{clearTimeout(timer);resolveReq(response)}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
 });
}
async function call(name,args){
 const msg=await request('tools/call',{name,arguments:args});
 if(msg?.result?.isError)throw Error(name+': '+msg.result.content?.[0]?.text);
 assert.ok(msg?.result,'missing '+name+' MCP result');
 return msg.result;
}
try{
 await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'phase3-godot',version:'1.0.0'}});
 await call('asset_create',{asset_id:cutout.assetId,width:source.canvas.width,height:source.canvas.height});
 const built=await call('document_apply_ops',{asset_id:cutout.assetId,expected_revision:0,
  idempotency_key:'phase3-original-lantern',operations:source.nodes.map(node=>({type:'node.add',node}))});
 const revision=JSON.parse(built.content[0].text).revision;
 assert.equal(revision,1);
 const previews=[];
 for(const time_seconds of [0,.125]){
  const res=await call('render_cutout_preview',{asset_id:cutout.assetId,cutout,clip_id:'idle',time_seconds});
  const image=res.content.find(item=>item.type==='image');
  const bytes=Buffer.from(image.data,'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),res.structuredContent.sha256);
  previews.push({pose:res.structuredContent.pose_ids.flame,sha256:res.structuredContent.sha256});
 }
 assert.notEqual(previews[0].pose,previews[1].pose);
 const exported=JSON.parse((await call('export_godot_cutout',{asset_id:cutout.assetId,cutout})).content[0].text);
 assert.equal(exported.version,2);
 assert.equal(exported.revision,revision);
 assert.match(exported.package_sha256,/^[a-f0-9]{64}$/);
 assert.match(exported.project,/^assets\/spirit_lantern\/godot-versions\/[a-f0-9]{64}$/);
 const pointer=JSON.parse(await readFile(join(workspace,'assets/spirit_lantern/godot-v2-current.json'),'utf8'));
 assert.equal(pointer.packageSha256,exported.package_sha256);
 const output=join(workspace,exported.project);
 await rm(generated,{recursive:true,force:true});
 await cp(output,generated,{recursive:true});
 await writeFile(join(generated,'validation.gd'),await readFile(join(root,'scripts/phase3-runtime-check.gd')));
 // The immutable MCP package stays deterministic and reusable. An authored
 // 2.5D gameplay scene is added only to this human-inspectable demo project.
 for(const [sourceFile,exportFile] of [
  ['phase3-showcase.tscn','showcase.tscn'],
  ['phase3-showcase-world.gd','showcase_world.gd'],
  ['phase3-showcase-capture.gd','showcase_capture.gd'],
  ['phase3-showcase-atmosphere.gdshader','showcase_atmosphere.gdshader']
 ]){
  await writeFile(join(generated,exportFile),await readFile(join(root,'scripts',sourceFile)));
 }
 for(const file of ['project.godot','main.tscn','validation.gd',
  'showcase.tscn','showcase_world.gd','showcase_capture.gd',
  'assets/spirit_lantern/atlas.png','assets/spirit_lantern/atlas.json',
  'assets/spirit_lantern/spirit_lantern.tscn']){
  assert.ok((await stat(join(generated,file))).size>0,file);
 }
 console.log(JSON.stringify({
  ok:true,asset:cutout.assetId,revision,parts:cutout.parts.length,
  flamePoses:cutout.poseVariants.length,packageSha256:exported.package_sha256,
  project:'examples/spirit-lantern/generated/phase3-godot',
  actualMcpFrames:previews,visualReview:'UNSCORED_AI_SELF_REVIEW'
 },null,2));
}finally{
 child.kill('SIGTERM');
 await rm(workspace,{recursive:true,force:true});
}
