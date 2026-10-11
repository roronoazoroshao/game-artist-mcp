import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AssetStore} from '../src/mcp/store.mjs';
import {applyOperations} from '../src/core/engine.mjs';
import {canonicalBytes,sha256Bytes} from '../src/evaluation/contracts.mjs';
import {publishGodotPackage} from '../src/export/atomic-package.mjs';

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'ga-consistency-'));
 const left=new AssetStore(root),right=new AssetStore(root);
 const state=await left.create('asset_one',64,64);
 return {root,left,right,state};
}
const modified=(state,id)=>applyOperations(state,{expectedRevision:state.revision,operations:[
 {type:'node.add',node:{id,type:'ellipse',cx:16,cy:16,rx:8,ry:8,fill:'#336699'}}
]});
const files=new Map([
 ['project.godot','config_version=5\n'],
 ['main.tscn','[gd_scene format=3]\n']
]);

test('independent writer rejects a stale revision rather than losing a committed edit',async()=>{
 const s=await fixture();
 try{
  await s.left.save('asset_one',modified(s.state,'first'));
  await assert.rejects(s.right.save('asset_one',modified(s.state,'stale')),/revision|STALE|conflict|ASSET_BUSY/i);
  const latest=await s.right.load('asset_one');
  assert.equal(latest.revision,1);
  assert.deepEqual(latest.document.nodes.map(n=>n.id),['first']);
 }finally{await rm(s.root,{recursive:true,force:true})}
});

test('two concurrent writers sharing a directory cannot both commit revision one',async()=>{
 const s=await fixture();
 try{
  const attempts=await Promise.allSettled([
   s.left.save('asset_one',modified(s.state,'alpha')),
   s.right.save('asset_one',modified(s.state,'beta'))
  ]);
  assert.equal(attempts.filter(v=>v.status==='fulfilled').length,1);
  const latest=await s.left.load('asset_one');
  assert.equal(latest.revision,1);
  assert.equal(latest.document.nodes.length,1);
 }finally{await rm(s.root,{recursive:true,force:true})}
});

test('a held asset transaction lock prevents publication of a stale snapshot',async()=>{
 const s=await fixture();
 try{
  const src=sha256Bytes(canonicalBytes(s.state.document));
  await s.left.withAssetWriteLock('asset_one',async()=>{
   await assert.rejects(publishGodotPackage({
    store:s.right,assetId:'asset_one',expectedRevision:0,sourceSha256:src,files
   }),/ASSET_BUSY/i);
  });
  const exported=await publishGodotPackage({
   store:s.right,assetId:'asset_one',expectedRevision:0,sourceSha256:src,files
  });
  assert.match(exported.packageSha256,/^[a-f0-9]{64}$/);
 }finally{await rm(s.root,{recursive:true,force:true})}
});

test('a symlinked asset root cannot redirect state writes outside the workspace',async()=>{
 const s=await fixture();
 const outer=await fixture();
 try{
  await rm(join(s.root,'assets','asset_one'),{recursive:true,force:true});
  await symlink(join(outer.root,'assets','asset_one'),join(s.root,'assets','asset_one'),'dir');
  await assert.rejects(s.left.save('asset_one',modified(outer.state,'hijack')),/symlink|unsafe|path|directory/i);
  assert.equal((await outer.left.load('asset_one')).revision,0);
 }finally{
  await rm(s.root,{recursive:true,force:true});
  await rm(outer.root,{recursive:true,force:true});
 }
});

test('state JSON symlink must never be read as workspace state',async()=>{
 const s=await fixture(),external=await fixture();
 try{
  await rm(s.left.statePath('asset_one'));
  await symlink(external.left.statePath('asset_one'),s.left.statePath('asset_one'));
  await assert.rejects(s.left.load('asset_one'),/symlink|unsafe|file/i);
 }finally{
  await rm(s.root,{recursive:true,force:true});
  await rm(external.root,{recursive:true,force:true});
 }
});

test('predictable state tmp-file symlink cannot overwrite an external sentinel',async()=>{
 const s=await fixture();
 const outside=await mkdtemp(join(tmpdir(),'ga-external-sentinel-'));
 const target=join(outside,'sentinel.txt');
 try{
  await writeFile(target,'DO_NOT_TOUCH','utf8');
  await symlink(target,s.left.statePath('asset_one')+'.'+process.pid+'.tmp');
  await s.left.save('asset_one',modified(s.state,'ok'));
  assert.equal(await readFile(target,'utf8'),'DO_NOT_TOUCH');
  assert.equal((await s.left.load('asset_one')).revision,1);
 }finally{
  await rm(s.root,{recursive:true,force:true});
  await rm(outside,{recursive:true,force:true});
 }
});
