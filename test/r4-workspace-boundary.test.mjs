import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AssetStore} from '../src/mcp/store.mjs';
import {applyOperations} from '../src/core/engine.mjs';

const stateLimit=16*1024*1024;
const temporary=async()=>mkdtemp(join(tmpdir(),'ga-r4-workspace-'));

test('asset creation rejects a symlinked workspace root before side effects',async()=>{
 const root=await temporary();
 const real=join(root,'real'),alias=join(root,'alias');
 try{
  await mkdir(real);
  await symlink(real,alias,'dir');
  const store=new AssetStore(alias);
  await assert.rejects(store.create('escaped',64,64),/unsafe|symlink/i);
  assert.deepEqual(await readdir(real),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('asset creation rejects symlinked assets base and never writes outside',async()=>{
 const root=await temporary(),outside=await temporary();
 try{
  await symlink(outside,join(root,'assets'),'dir');
  const store=new AssetStore(root);
  await assert.rejects(store.create('escaped',64,64),/unsafe|symlink/i);
  assert.deepEqual(await readdir(outside),[]);
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
});

test('oversized valid state JSON is rejected on read before large allocation',async()=>{
 const root=await temporary(),store=new AssetStore(root);
 try{
  await store.create('bounded',64,64);
  const original=await readFile(store.statePath('bounded'),'utf8');
  await writeFile(store.statePath('bounded'),original+' '.repeat(stateLimit+1));
  await assert.rejects(store.load('bounded'),/STATE_SIZE_LIMIT|budget/i);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('oversized updated state is rejected without replacing last-good revision',async()=>{
 const root=await temporary(),store=new AssetStore(root);
 try{
  const state=await store.create('bounded',64,64);
  const next=applyOperations(state,{
   expectedRevision:0,
   operations:[{type:'node.add',node:{id:'dot',type:'ellipse',cx:20,cy:20,rx:5,ry:5,fill:'#123456'}}]
  });
  next.history[0].comment='X'.repeat(stateLimit+1);
  await assert.rejects(store.save('bounded',next),/STATE_SIZE_LIMIT|budget/i);
  const persisted=await store.load('bounded');
  assert.equal(persisted.revision,0);
  assert.equal(persisted.document.nodes.length,0);
 }finally{await rm(root,{recursive:true,force:true})}
});
