#!/usr/bin/env node
// Reproducible cross-process ChatGPT Web screenshot handoff.
// This is a transport/identity smoke; the script DOES NOT pretend to make artistic choices.
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace} from '../src/ai-art/paint-workstation.mjs';
import {GodotPaintObserver} from '../src/ai-art/godot-paint-observer.mjs';
import {ArtistVisionSession} from '../src/ai-art/vision-session.mjs';

const filename=fileURLToPath(import.meta.url);
const stage=process.argv[2],root=process.argv[3];

async function actor(){
 const store=new AssetStore(root);
 const paint=new PaintWorkspace(store);
 const session=new ArtistVisionSession({paint,observer:new GodotPaintObserver({paint})});
 if(stage==='capture'){
  await store.create('web_handoff_lantern',128,128);
  await paint.open('web_handoff_lantern');
  await paint.apply('web_handoff_lantern',{expectedRevision:0,operations:[{
   type:'stroke.draw',layerId:'base',color:'#47dcf0',radius:6,opacity:1,
   points:[[45,50,1],[65,77,1],[80,50,.6]]
  }]});
  await session.begin('web_handoff_lantern',{brief:'Verify exact preserved real Godot image evidence after a ChatGPT Web controller restart',
   maxIterations:1,size:128,environment:'twilight'});
  const o=await session.observe('web_handoff_lantern',{expectedVersion:0});
  return {sha:o.observationSha256,base64:o.png.toString('base64'),version:o.version,
   phase:o.phase,artisticReview:o.artisticReview,exportAllowed:o.exportAllowed};
 }
 if(stage==='reinspect'){
  const o=await session.reinspect('web_handoff_lantern',{expectedVersion:1});
  const s=await session.status('web_handoff_lantern');
  return {sha:o.observationSha256,base64:o.png.toString('base64'),version:s.version,
   phase:s.phase,evidenceMode:o.evidenceMode,artisticReview:o.artisticReview,exportAllowed:o.exportAllowed};
 }
 throw Error('invalid actor stage');
}
if(stage){
 const result=await actor();
 process.stdout.write(JSON.stringify(result)+'\n');
}else{
 const temp=await mkdtemp(join(tmpdir(),'game-artist-web-handoff-'));
 try{
  const run=mode=>{
   const processResult=spawnSync(process.execPath,[filename,mode,temp],{
    cwd:process.cwd(),encoding:'utf8',timeout:90000,maxBuffer:1048576
   });
   assert.equal(processResult.status,0,'stage '+mode+' failed: '+processResult.stderr?.slice(-1600));
   return JSON.parse(processResult.stdout.trim());
  };
  const a=run('capture'),b=run('reinspect');
  assert.equal(a.version,1);
  assert.equal(b.version,1);
  assert.equal(b.phase,'AWAITING_CRITIQUE');
  assert.equal(a.sha,b.sha);
  assert.equal(a.base64,b.base64);
  assert.equal(b.evidenceMode,'EXACT_STORED_GODOT_PNG_NO_RECAPTURE');
  assert.equal(b.artisticReview,'UNSCORED');
  assert.equal(b.exportAllowed,false);
  console.log(JSON.stringify({status:'CHATGPT_WEB_EXACT_GODOT_FRAME_RESTORED_AFTER_PROCESS_RESTART',
   firstSha256:a.sha,recoveredSha256:b.sha,imageBytes:Buffer.from(b.base64,'base64').length,
   modelArtworkReview:'NOT_RUN_TEST_FIXTURE_ONLY',rightsVerified:false,exportAllowed:false}));
 }finally{await rm(temp,{force:true,recursive:true})}
}