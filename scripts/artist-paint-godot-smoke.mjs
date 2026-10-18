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
 const bin=process.env.GODOT_BIN||'godot';
 for(const args of [
  ['--headless','--path',path,'--editor','--quit'],
  ['--headless','--path',path,'--quit-after',3]
 ]){
  const result=spawnSync(bin,args,{encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
  if(result.status!==0||/SCRIPT ERROR|Parse Error|ERROR:/.test(result.stdout+'\n'+result.stderr))
   throw Error('GODOT_IMPORT_OR_RUNTIME_FAILED exit='+result.status+' '+(result.stderr||result.stdout).slice(-1500));
 }
 console.log(JSON.stringify({status:'REAL_GODOT_STATIC_PAINT_PASS',
  revision:exported.revision,pngSha256:exported.pngSha256,packageSha256:exported.packageSha256,
  godot:bin,artisticReview:exported.artisticReview,exportAllowed:exported.exportAllowed}));
}finally{await rm(work,{recursive:true,force:true});}
