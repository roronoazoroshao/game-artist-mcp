import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AssetStore} from '../src/mcp/store.mjs';
import {applyOperations} from '../src/core/engine.mjs';

const writerCode = `
import {AssetStore} from './src/mcp/store.mjs';
import {applyOperations} from './src/core/engine.mjs';
const [root,id] = process.argv.slice(1);
const store = new AssetStore(root);
const current = await store.load('asset_one');
const state = applyOperations(current,{expectedRevision:current.revision,operations:[
 {type:'node.add',node:{id,type:'ellipse',cx:16,cy:16,rx:8,ry:8,fill:'#336699'}}
]});
process.send('READY');
process.on('message',async (message)=>{
 if(message!=='GO')return;
 try{
  await store.save('asset_one',state);
  process.send({kind:'DONE',status:'ok'},()=>process.exit(0));
 }catch(error){
  process.send({kind:'DONE',status:'reject',error:String(error.message)},()=>process.exit(0));
 }
});
`;
const lockCode = `
import {AssetStore} from './src/mcp/store.mjs';
const store = new AssetStore(process.argv[1]);
await store.withAssetWriteLock('asset_one',async()=>{
 process.send('READY');
 await new Promise(()=>{});
});
`;
function startReady(source,args){
 const child=spawn(process.execPath,['--input-type=module','-e',source,...args],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe','ipc']
 });
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(new Error('child readiness timeout'))},10000);
  child.once('error',e=>{clearTimeout(timer);reject(e)});
  child.once('exit',(code)=>{clearTimeout(timer);reject(new Error('child exited before ready: '+code))});
  child.on('message',m=>{if(m==='READY'){clearTimeout(timer);resolve(child)}});
 });
}
function resultOf(child){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(new Error('child result timeout'))},10000);
  child.on('message',m=>{if(m?.kind==='DONE'){clearTimeout(timer);resolve(m)}});
  child.once('error',e=>{clearTimeout(timer);reject(e)});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error('child exited before result: '+code))});
 });
}
const modified=(state)=>applyOperations(state,{expectedRevision:0,operations:[
 {type:'node.add',node:{id:'restored',type:'ellipse',cx:12,cy:12,rx:4,ry:4,fill:'#336699'}}
]});
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'ga-r4-process-'));
 const store=new AssetStore(root);
 const state=await store.create('asset_one',64,64);
 return {root,store,state};
}

test('two separate Node processes cannot both commit the same asset revision',async()=>{
 const s=await setup();let a,b;
 try{
  a=await startReady(writerCode,[s.root,'first']);
  b=await startReady(writerCode,[s.root,'second']);
  const resultA=resultOf(a),resultB=resultOf(b);
  a.send('GO');b.send('GO');
  const results=await Promise.all([resultA,resultB]);
  assert.equal(results.filter(x=>x.status==='ok').length,1,JSON.stringify(results));
  assert.equal(results.filter(x=>x.status==='reject').length,1,JSON.stringify(results));
  const state=await s.store.load('asset_one');
  assert.equal(state.revision,1);
  assert.equal(state.document.nodes.length,1);
  assert.ok(['first','second'].includes(state.document.nodes[0].id));
 }finally{a?.kill();b?.kill();await rm(s.root,{recursive:true,force:true})}
});

test('crashed lock holder leaves fail-closed state and manual recovery preserves state',async()=>{
 const s=await setup();let holder;
 try{
  holder=await startReady(lockCode,[s.root]);
  await assert.rejects(s.store.save('asset_one',modified(s.state)),/ASSET_BUSY/);
  const exited=once(holder,'exit');
  holder.kill('SIGKILL');
  await exited;
  await assert.rejects(s.store.save('asset_one',modified(s.state)),/ASSET_BUSY/);
  assert.equal((await s.store.load('asset_one')).revision,0);
  // This is a controlled test simulation: NEVER automate this removal in production.
  await rmdir(join(s.store.assetDir('asset_one'),'.asset-write-lock'));
  await s.store.save('asset_one',modified(s.state));
  assert.equal((await s.store.load('asset_one')).revision,1);
 }finally{holder?.kill();await rm(s.root,{recursive:true,force:true})}
});
