import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AssetStore} from '../src/mcp/store.mjs';
import {canonicalBytes,sha256Bytes} from '../src/evaluation/contracts.mjs';
import {publishGodotPackage} from '../src/export/atomic-package.mjs';

const data=id=>new Map([
 ['project.godot','config_version=5\n'],
 ['main.tscn','[gd_scene format=3]\n'],
 ['validation.gd','extends Node2D\n'],
 ['assets/'+id+'/atlas.png',Buffer.from([137,80,78,71,13,10,26,10])],
 ['assets/'+id+'/atlas.json','{"version":2}\n']
]);
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'ga-atomic-test-'));
 const store=new AssetStore(root);
 const state=await store.create('phase3_asset',64,64);
 const sourceSha256=sha256Bytes(canonicalBytes(state.document));
 return {root,store,sourceSha256,revision:state.revision};
}
test('publishes immutable content hash directory and atomic current pointer',async()=>{
 const s=await setup();
 try{
  const params={store:s.store,assetId:'phase3_asset',expectedRevision:0,sourceSha256:s.sourceSha256,files:data('phase3_asset')};
  const first=await publishGodotPackage(params);
  const second=await publishGodotPackage(params);
  assert.equal(first.packageSha256,second.packageSha256);
  assert.equal(first.projectPath,second.projectPath);
  assert.ok((await stat(join(first.projectPath,'project.godot'))).isFile());
  const current=JSON.parse(await readFile(join(s.root,'assets/phase3_asset/godot-v2-current.json'),'utf8'));
  assert.equal(current.packageSha256,first.packageSha256);
  assert.equal(current.sourceRevision,0);
  assert.match(current.project,/^godot-versions\/[a-f0-9]{64}$/);
 }finally{await rm(s.root,{recursive:true,force:true})}
});
test('malformed output paths and revisions never change last-good pointer',async()=>{
 const s=await setup();
 try{
  const params={store:s.store,assetId:'phase3_asset',expectedRevision:0,sourceSha256:s.sourceSha256,files:data('phase3_asset')};
  await publishGodotPackage(params);
  const at=join(s.root,'assets/phase3_asset/godot-v2-current.json');
  const good=await readFile(at);
  await assert.rejects(publishGodotPackage({...params,expectedRevision:8}),/STALE_SOURCE_REVISION/);
  await assert.rejects(publishGodotPackage({...params,sourceSha256:'0'.repeat(64)}),/STALE_SOURCE_REVISION/);
  const malicious=data('phase3_asset');malicious.set('../escaped.gd','evil');
  await assert.rejects(publishGodotPackage({...params,files:malicious}),/unsafe|path|invalid/i);
  assert.deepEqual(await readFile(at),good);
 }finally{await rm(s.root,{recursive:true,force:true})}
});
test('symlinked version directory is rejected without writing outside the workspace',async()=>{
 const s=await setup();
 const external=await mkdtemp(join(tmpdir(),'ga-outside-'));
 try{
  const dir=join(s.root,'assets/phase3_asset/godot-versions');
  await symlink(external,dir,'dir');
  await assert.rejects(publishGodotPackage({store:s.store,assetId:'phase3_asset',expectedRevision:0,
    sourceSha256:s.sourceSha256,files:data('phase3_asset')}),/symlink|unsafe|directory/i);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(external),[]);
 }finally{await rm(s.root,{recursive:true,force:true});await rm(external,{recursive:true,force:true})}
});
