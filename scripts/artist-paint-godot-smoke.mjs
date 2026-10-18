#!/usr/bin/env node
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace,renderPaint} from '../src/ai-art/paint-workstation.mjs';
const work=await mkdtemp(join(tmpdir(),'game-artist-paint-godot-'));
try{
 const store=new AssetStore(work);
 await store.create('ai_painted_lantern',128,128);
 const paint=new PaintWorkspace(store);
 await paint.open('ai_painted_lantern');
 const p=await paint.apply('ai_painted_lantern',{expectedRevision:0,operations:[
  {type:'layer.create',layerId:'ember'},
  {type:'stroke.draw',layerId:'ember',color:'#c5ffef',radius:10,opacity:1,points:[[64,28,.3],[64,66,1],[62,84,.5]]},
  {type:'layer.settings',layerId:'ember',mask:{x:30,y:16,width:68,height:95}}
 ]});
 const exported=await paint.exportGodot('ai_painted_lantern',{expectedRevision:p.revision});
 const path=join(work,exported.project);
 const png=await readFile(join(path,'art.png'));
 const preview=renderPaint(p);
 if(!png.equals(preview.png))throw Error('export PNG does not match actual observed paint preview');
 // R2: Import source PNG as editable raster layer, correct it with a brush,
 // export another real Godot project and check image byte equality.
 await store.create('ai_imported_lantern',128,128);
 await paint.open('ai_imported_lantern');
 const imported=await paint.importPng('ai_imported_lantern',{expectedRevision:0,
  layerId:'reference',imageBase64:png.toString('base64'),sourceLabel:'local-generated-test'});
 const corrected=await paint.apply('ai_imported_lantern',{expectedRevision:1,operations:[
  {type:'stroke.draw',layerId:'reference',color:'#fff4c5',radius:5,opacity:.8,
   points:[[56,55,.8],[69,65,1]]}
 ]});
 const importedPackage=await paint.exportGodot('ai_imported_lantern',{expectedRevision:corrected.revision});
 const importedPath=join(work,importedPackage.project);
 const importedPng=await readFile(join(importedPath,'art.png'));
 if(!importedPng.equals(renderPaint(corrected).png))
  throw Error('imported source paint does not match corrected Godot output');
 if(importedPackage.exportAllowed!==false||importedPackage.artisticReview!=='UNSCORED')
  throw Error('source claim must not cause art/rights GO');
 const bin=process.env.GODOT_BIN||'godot';
 for(const scenePath of [path,importedPath])for(const args of [
  ['--headless','--path',scenePath,'--editor','--quit'],
  ['--headless','--path',scenePath,'--quit-after',3]
 ]){
  const result=spawnSync(bin,args,{encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
  if(result.status!==0||/SCRIPT ERROR|Parse Error|ERROR:/.test(result.stdout+'\n'+result.stderr))
   throw Error('GODOT_IMPORT_OR_RUNTIME_FAILED exit='+result.status+' '+(result.stderr||result.stdout).slice(-1500));
 }
 console.log(JSON.stringify({status:'REAL_GODOT_STATIC_PAINT_PASS',
  revision:exported.revision,pngSha256:exported.pngSha256,packageSha256:exported.packageSha256,
  importedRevision:corrected.revision,importedSourceSha256:imported.history[0].operations[0].sourceSha256,
  importedPackageSha256:importedPackage.packageSha256,
  godot:bin,artisticReview:exported.artisticReview,exportAllowed:exported.exportAllowed}));
}finally{await rm(work,{recursive:true,force:true});}
