import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace,renderPaint,analyzePaintDifference} from '../src/ai-art/paint-workstation.mjs';
const {PNG}=pngjs;
async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'game-artist-paint-'));
 try {
  const store=new AssetStore(root);await store.create('new_asset',128,128);
  const paint=new PaintWorkspace(store);
  await fn({store,paint,root});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('painting creates editable layer, brush, clip/mask and eraser without changing vector asset',async()=>sandbox(async({store,paint})=>{
 const original=await store.load('new_asset');
 await paint.open('new_asset');
 const p=await paint.apply('new_asset',{expectedRevision:0,operations:[
  {type:'layer.create',layerId:'glow'},
  {type:'stroke.draw',layerId:'glow',color:'#22ccff',radius:8,opacity:1,points:[[32,32,1],[96,32,.8]]}
 ]});
 assert.equal(p.revision,1);
 const painted=renderPaint(p);const dec=PNG.sync.read(painted.png);
 assert.equal(dec.width,128);assert.equal(dec.height,128);
 assert.ok(painted.metrics.occupiedPixels>100);
 const changed=await paint.apply('new_asset',{expectedRevision:1,operations:[
  {type:'layer.settings',layerId:'glow',mask:{x:0,y:0,width:64,height:128},opacity:.75},
  {type:'stroke.erase',layerId:'glow',radius:4,opacity:1,points:[[32,32,1]]}
 ]});
 const diff=analyzePaintDifference(p,changed);
 assert.ok(diff.changedPixels>0);
 assert.equal(diff.candidateRevision,2);
 assert.deepEqual(await store.load('new_asset'),original);
 const restored=await paint.restore('new_asset',{expectedRevision:2,targetRevision:1});
 assert.equal(restored.revision,3);
 assert.equal(renderPaint(restored).sha256,renderPaint(p).sha256);
}));
test('paint mutations reject stale revision and malformed/unbounded requests fail-closed',async()=>sandbox(async({paint})=>{
 await paint.open('new_asset');
 const bad=[
  [{type:'stroke.draw',layerId:'missing',color:'#ffaa22',radius:4,opacity:1,points:[[3,4,1]]}],
  [{type:'layer.create',layerId:'../etc'}],
  [{type:'layer.create',layerId:'a',unknown:true}],
  [{type:'layer.create',layerId:'a'},{type:'stroke.draw',layerId:'a',color:'#ffeeaa',radius:999,opacity:1,points:[[20,20,1]]}],
  [{type:'layer.settings',layerId:'base',mask:{x:-1,y:0,width:50,height:50}}],
 ];
 for(const operations of bad)await assert.rejects(paint.apply('new_asset',{expectedRevision:0,operations}),/PAINT_REJECTED/);
 await assert.rejects(paint.restore('new_asset',{expectedRevision:0,targetRevision:0}),/PAINT_REJECTED/);
 assert.equal((await paint.load('new_asset')).revision,0);
 const p=await paint.apply('new_asset',{expectedRevision:0,operations:[{type:'layer.create',layerId:'one'}]});
 assert.equal(p.revision,1);
 await assert.rejects(paint.apply('new_asset',{expectedRevision:0,operations:[{type:'layer.create',layerId:'two'}]}),/revision conflict/);
}));
test('reloading workspace yields same PNG and rejects existing symlinked painting state',async()=>sandbox(async({store,paint,root})=>{
 await paint.open('new_asset');
 const p=await paint.apply('new_asset',{expectedRevision:0,operations:[{type:'stroke.draw',layerId:'base',color:'#443322',radius:3,opacity:1,points:[[20,20,1]]}]});
 const again=new PaintWorkspace(store);
 assert.equal(renderPaint(await again.load('new_asset')).sha256,renderPaint(p).sha256);
 await rm(join(root,'assets/new_asset/painting.json'));
 await symlink(join(root,'assets/new_asset/state.json'),join(root,'assets/new_asset/painting.json'));
 await assert.rejects(again.load('new_asset'),/PAINT_REJECTED/);
}));
test('rejects oversized brush workloads and never commits a rejected batch',async()=>sandbox(async({paint})=>{
 await paint.open('new_asset');
 const ops=[{type:'layer.create',layerId:'details'}];
 for(let i=0;i<11;i++)ops.push({type:'stroke.draw',layerId:'details',color:'#bbaacc',radius:24,opacity:1,
  points:[[0,12+i,1],[128,112+i,1]]});
 await assert.rejects(paint.apply('new_asset',{expectedRevision:0,operations:ops}),/PAINT_REJECTED: cumulative brush work budget/);
 assert.equal((await paint.load('new_asset')).revision,0);
}));
test('concurrent writers cannot overwrite each other and preserve revision integrity',async()=>sandbox(async({paint})=>{
 await paint.open('new_asset');
 const inputs=['east','west'].map(layerId=>paint.apply('new_asset',{
  expectedRevision:0,operations:[{type:'layer.create',layerId}]}));
 const results=await Promise.allSettled(inputs);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal((await paint.load('new_asset')).revision,1);
}));
test('paint export is immutable, rejects stale revisions and unsafe export path',async()=>sandbox(async({paint,root})=>{
 await paint.open('new_asset');
 const a=await paint.exportGodot('new_asset',{expectedRevision:0});
 const b=await paint.exportGodot('new_asset',{expectedRevision:0});
 assert.deepEqual(a,b);
 assert.equal(a.artisticReview,'UNSCORED');
 assert.equal(a.exportAllowed,false);
 await paint.apply('new_asset',{expectedRevision:0,operations:[{type:'layer.create',layerId:'new'}]});
 await assert.rejects(paint.exportGodot('new_asset',{expectedRevision:0}),/revision conflict/);
}));
