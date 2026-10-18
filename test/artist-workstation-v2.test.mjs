import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace,renderPaint,renderPaintDiff,evaluatePaintProgress} from '../src/ai-art/paint-workstation.mjs';
const {PNG}=pngjs;
const fixture=(w=64,h=64)=>{
 const img=new PNG({width:w,height:h});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  img.data[i]=30;img.data[i+1]=150;img.data[i+2]=230;
  img.data[i+3]=x<32&&y<32?255:0;
 }
 return PNG.sync.write(img).toString('base64');
};
async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'artist-v2-'));
 try{
  const store=new AssetStore(root);await store.create('painting',64,64);
  const paint=new PaintWorkspace(store);await paint.open('painting');
  await fn({root,store,paint});
 }finally{await rm(root,{recursive:true,force:true})}
}
test('import authored RGBA PNG via untrusted base64 onto its own layer; further brush edit and historical restore',async()=>sandbox(async({paint,store})=>{
 const untouched=await store.load('painting');
 const img=fixture();
 const imported=await paint.importPng('painting',{expectedRevision:0,layerId:'reference',imageBase64:img,sourceLabel:'user-provided-prop'});
 assert.equal(imported.revision,1);
 assert.equal(imported.history[0].operations[0].type,'layer.import_png');
 assert.match(imported.history[0].operations[0].sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(imported.rightsVerified,false);
 const first=renderPaint(imported);
 assert.equal(first.metrics.occupiedPixels,1024);
 assert.equal(PNG.sync.read(first.png).data[3],255);
 const edited=await paint.apply('painting',{expectedRevision:1,operations:[
  {type:'stroke.draw',layerId:'reference',color:'#ffffff',radius:6,opacity:1,points:[[52,52,1]]}
 ]});
 assert.ok(renderPaint(edited).metrics.occupiedPixels>1024);
 const restored=await paint.restore('painting',{expectedRevision:2,targetRevision:1});
 assert.equal(renderPaint(restored).sha256,first.sha256);
 assert.deepEqual(await store.load('painting'),untouched);
 const reloaded=await paint.load('painting');
 assert.equal(reloaded.revision,3);
 assert.equal(renderPaint(reloaded).sha256,first.sha256);
}));
test('rejects malformed/base64 forged, oversized, non-RGBA and wrong-geometry image before advancing revision',async()=>sandbox(async({paint})=>{
 const valid=fixture();
 const giant=Buffer.from(valid,'base64');
 giant.writeUInt32BE(1024*1024,16);
 const nonRgba=Buffer.from(valid,'base64');
 nonRgba[25]=2;
 for(const bad of [
  'https://evil.test/reference.png',
  valid+'==garbage',
  'bWlzc2luZy1wbmc=',
  giant.toString('base64'),
  nonRgba.toString('base64'),
  fixture(32,64),
  'A'.repeat(190000)
 ]){
  await assert.rejects(paint.importPng('painting',{expectedRevision:0,layerId:'original',imageBase64:bad,sourceLabel:'personal'}),/PAINT_REJECTED/);
 }
 assert.equal((await paint.load('painting')).revision,0);
}));
test('bounded import/sha preservation and optimistic version conflicts',async()=>sandbox(async({paint})=>{
 const bytes=fixture();
 await paint.importPng('painting',{expectedRevision:0,layerId:'a',imageBase64:bytes,sourceLabel:'a'});
 await assert.rejects(paint.importPng('painting',{expectedRevision:0,layerId:'b',imageBase64:bytes,sourceLabel:'b'}),/revision conflict/);
 await paint.importPng('painting',{expectedRevision:1,layerId:'b',imageBase64:bytes,sourceLabel:'b'});
 await assert.rejects(paint.importPng('painting',{expectedRevision:2,layerId:'c',imageBase64:bytes,sourceLabel:'c'}),/PAINT_REJECTED/);
 assert.equal((await paint.load('painting')).revision,2);
}));
test('pixel diff preview is real, bounded PNG and technical rubric never claims ARTISTIC_GO',async()=>sandbox(async({paint})=>{
 await paint.importPng('painting',{expectedRevision:0,layerId:'ref',imageBase64:fixture(),sourceLabel:'original'});
 const base=await paint.load('painting');
 const next=await paint.apply('painting',{expectedRevision:1,operations:[
  {type:'stroke.draw',layerId:'ref',color:'#ecfeff',radius:8,opacity:1,points:[[45,45,1]]}
 ]});
 const diff=renderPaintDiff(base,next,{size:64});
 assert.equal(diff.status,'TECHNICAL_DIFF_ONLY');
 assert.ok(diff.changedPixels>0);
 assert.equal(PNG.sync.read(diff.png).width,64);
 const evaluation=evaluatePaintProgress(base,next,{size:64,minCoverage:0.01,maxCoverage:0.9,minChangedPixels:5,maxIterations:3});
 assert.equal(evaluation.result,'OBJECTIVE_TARGET_MET');
 assert.equal(evaluation.artisticReview,'UNSCORED');
 assert.equal(evaluation.exportAllowed,false);
 const tooSoon=evaluatePaintProgress(base,base,{size:64,minChangedPixels:10,maxIterations:2});
 assert.equal(tooSoon.result,'REVISION_REQUIRED');
 assert.equal(tooSoon.artisticReview,'UNSCORED');
 assert.throws(()=>evaluatePaintProgress(base,next,{size:64,maxIterations:0}),/PAINT_REJECTED/);
}));
test('import data forensic validation detects post-write PNG/rights tampering in persisted journal',async()=>sandbox(async({paint,root})=>{
 await paint.importPng('painting',{expectedRevision:0,layerId:'evidence',imageBase64:fixture(),sourceLabel:'local-preview'});
 const file=join(root,'assets/painting/painting.json');
 const {readFile,writeFile}=await import('node:fs/promises');
 let json=JSON.parse(await readFile(file,'utf8'));
 json.history[0].operations[0].sourceSha256='1'.repeat(64);
 await writeFile(file,JSON.stringify(json));
 await assert.rejects(paint.load('painting'),/PAINT_REJECTED: source digest mismatch/);
 json.history[0].operations[0].sourceSha256='2'.repeat(64);
 json.rightsVerified=true;
 await writeFile(file,JSON.stringify(json));
 await assert.rejects(paint.load('painting'),/PAINT_REJECTED/);
}));
test('invalid source labels, stale revision and duplicate layer never mutate storage',async()=>sandbox(async({paint})=>{
 const png=fixture();
 await assert.rejects(paint.importPng('painting',{expectedRevision:0,layerId:'x',imageBase64:png,sourceLabel:'http://evil.test/png'}),/PAINT_REJECTED/);
 await assert.rejects(paint.importPng('painting',{expectedRevision:0,layerId:'../../etc',imageBase64:png,sourceLabel:'owned'}),/PAINT_REJECTED/);
 assert.equal((await paint.load('painting')).revision,0);
 await paint.importPng('painting',{expectedRevision:0,layerId:'x',imageBase64:png,sourceLabel:'owned'});
 await assert.rejects(paint.importPng('painting',{expectedRevision:1,layerId:'x',imageBase64:png,sourceLabel:'owned'}),/PAINT_REJECTED/);
 assert.equal((await paint.load('painting')).revision,1);
}));
test('paint evaluate exhausted budget, invalid rubric and no false beauty assessment',async()=>sandbox(async({paint})=>{
 const s=await paint.load('painting');
 let p=s;
 for(let i=0;i<2;i++)p=await paint.apply('painting',{expectedRevision:i,operations:[{type:'layer.create',layerId:'layer'+i}]});
 const x=evaluatePaintProgress(s,p,{minChangedPixels:100,maxIterations:2});
 assert.equal(x.result,'RETRY_BUDGET_EXHAUSTED');
 assert.equal(x.humanOrAiVisualInspectionRequired,true);
 assert.equal(x.rightsVerified,false);
 assert.throws(()=>evaluatePaintProgress(s,p,{minCoverage:.9,maxCoverage:.1}),/PAINT_REJECTED/);
}));
test('Godot export of imported painted image preserves non-attested original source SHA in evidence metadata',async()=>sandbox(async({paint,root})=>{
 const imported=await paint.importPng('painting',{expectedRevision:0,layerId:'original',imageBase64:fixture(),sourceLabel:'user-source'});
 const sourceSha256=imported.history[0].operations[0].sourceSha256;
 const exported=await paint.exportGodot('painting',{expectedRevision:1});
 const {readFile}=await import('node:fs/promises');
 const evidence=JSON.parse(await readFile(join(root,exported.project,'evidence.json'),'utf8'));
 assert.deepEqual(evidence.importedSources,[{layerId:'original',sourceSha256,sourceLabel:'user-source',rightsVerified:false}]);
 assert.equal(evidence.exportAllowed,false);
}));
test('restore must not permit a third lifetime import via journal replay reset',async()=>sandbox(async({paint})=>{
 const src=fixture();
 await paint.importPng('painting',{expectedRevision:0,layerId:'a',imageBase64:src,sourceLabel:'one'});
 await paint.importPng('painting',{expectedRevision:1,layerId:'b',imageBase64:src,sourceLabel:'two'});
 await paint.restore('painting',{expectedRevision:2,targetRevision:0});
 await assert.rejects(paint.importPng('painting',{expectedRevision:3,layerId:'c',imageBase64:src,sourceLabel:'three'}),/PAINT_REJECTED: import quota/);
 assert.equal((await paint.load('painting')).revision,3);
}));
