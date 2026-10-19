import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace,renderPaint} from '../src/ai-art/paint-workstation.mjs';
import {ArtistVisionSession} from '../src/ai-art/vision-session.mjs';

const ENGINE_IMAGE=Buffer.from('Godot captured PNG fixture bytes; fake engine for session unit tests; no aesthetic measurement');
const SHA=createHash('sha256').update(ENGINE_IMAGE).digest('hex');
const sample={png:ENGINE_IMAGE,sha256:SHA,engine:'REAL_GODOT_FRAMEBUFFER',
 scene:'DETERMINISTIC_ART_STAGING_FIXTURE',sourcePaintSha256:'a'.repeat(64),
 artisticReview:'UNSCORED',exportAllowed:false,rightsVerified:false};
const makeObserver=paint=>({async observe(assetId,options){return {...sample,revision:options.revision,size:options.size,environment:options.environment,sourcePaintSha256:renderPaint(await paint.load(assetId),{revision:options.revision}).sha256}}});
const strokes=(layerId='base')=>[{type:'stroke.draw',layerId,color:'#eeaa44',radius:4,opacity:1,points:[[12,12,1],[36,36,.6]]}];
async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'artist-v4-'));
 try{
  const store=new AssetStore(root);await store.create('lantern',64,64);
  const paint=new PaintWorkspace(store);await paint.open('lantern');
  const session=new ArtistVisionSession({paint,observer:makeObserver(paint)});
  await fn({root,store,paint,session});
 }finally{await rm(root,{recursive:true,force:true})}
}
test('real observer-bound AI-host session revises, observes again, finishes pending art approval',async()=>sandbox(async({session,paint,store})=>{
 const original=await store.load('lantern');
 const start=await session.begin('lantern',{brief:'Enhance flame readability at 64px',size:64,environment:'twilight',maxIterations:2});
 assert.equal(start.phase,'NEEDS_OBSERVATION');
 const one=await session.observe('lantern',{expectedVersion:0});
 assert.equal(one.observationSha256,SHA);
 assert.equal(one.phase,'AWAITING_CRITIQUE');
 assert.ok(one.png.length>1);
 const updated=await session.decide('lantern',{
  expectedVersion:1,observationSha256:SHA,decision:'REVISE',
  critique:'Flame needs stronger luminance contrast at the center',operations:strokes()
 });
 assert.equal(updated.phase,'NEEDS_OBSERVATION');
 assert.equal(updated.iteration,1);
 assert.equal((await paint.load('lantern')).revision,1);
 const two=await session.observe('lantern',{expectedVersion:2});
 assert.equal(two.observationSha256,SHA);
 const finished=await session.decide('lantern',{expectedVersion:3,observationSha256:SHA,decision:'FINISH',
  critique:'Sufficient for submitting to art director; not independently approved.'});
 assert.equal(finished.phase,'REVIEW_PENDING');
 assert.equal(finished.artisticReview,'UNSCORED');
 assert.equal(finished.exportAllowed,false);
 assert.equal((await session.status('lantern')).iteration,1);
 assert.deepEqual(await store.load('lantern'),original);
}));
test('rejects spoofed observation, stale session version and no visual critique without advancing painting',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Fix core flame',size:128,environment:'moonlight',maxIterations:2});
 await assert.rejects(session.decide('lantern',{expectedVersion:0,observationSha256:SHA,decision:'REVISE',critique:'xx',operations:strokes()}),/VISION_SESSION_REJECTED/);
 await session.observe('lantern',{expectedVersion:0});
 const bad=[
  {expectedVersion:0,observationSha256:SHA,decision:'REVISE',critique:'correct',operations:strokes()},
  {expectedVersion:1,observationSha256:'0'.repeat(64),decision:'REVISE',critique:'correct',operations:strokes()},
  {expectedVersion:1,observationSha256:SHA,decision:'REVISE',critique:'',operations:strokes()},
  {expectedVersion:1,observationSha256:SHA,decision:'APPROVE',critique:'pretty',operations:strokes()},
  {expectedVersion:1,observationSha256:SHA,decision:'REVISE',critique:'valid',operations:[{type:'run_shell',command:'unsafe-test-operation'}]}
 ];
 for(const request of bad)await assert.rejects(session.decide('lantern',request),/VISION_SESSION_REJECTED|PAINT_REJECTED/);
 assert.equal((await paint.load('lantern')).revision,0);
}));
test('budget exhaustion blocks further revision and cannot self-grant artistic GO',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Clean geometry',size:64,environment:'twilight',maxIterations:1});
 await session.observe('lantern',{expectedVersion:0});
 const out=await session.decide('lantern',{expectedVersion:1,observationSha256:SHA,decision:'REVISE',critique:'needs work',operations:strokes()});
 assert.equal(out.iteration,1);
 assert.equal(out.phase,'NEEDS_OBSERVATION');
 await session.observe('lantern',{expectedVersion:2});
 await assert.rejects(session.decide('lantern',{expectedVersion:3,observationSha256:SHA,decision:'REVISE',critique:'again',operations:strokes()}),/VISION_SESSION_REJECTED/);
 const decision=await session.decide('lantern',{expectedVersion:3,observationSha256:SHA,decision:'FINISH',critique:'hand off to real artist'});
 assert.equal(decision.phase,'REVIEW_PENDING');
 assert.equal((await paint.load('lantern')).revision,1);
}));
test('REVERT is append-only, safe, and audited; rollback to source before session',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Evaluate lantern',size:64,environment:'twilight',maxIterations:2});
 await session.observe('lantern',{expectedVersion:0});
 await session.decide('lantern',{expectedVersion:1,observationSha256:SHA,decision:'REVISE',critique:'light is weak',operations:strokes()});
 await session.observe('lantern',{expectedVersion:2});
 const x=await session.decide('lantern',{expectedVersion:3,observationSha256:SHA,decision:'REVERT',critique:'new light unreadable'});
 assert.equal(x.phase,'REVIEW_PENDING');
 assert.equal(x.iteration,1);
 assert.equal((await paint.load('lantern')).revision,2);
}));
test('no arbitrary checkpoint path or symlink',async()=>sandbox(async({session,root})=>{
 await session.begin('lantern',{brief:'Rim lighting',size:64,environment:'twilight',maxIterations:2});
 const file=join(root,'assets','lantern','vision-session.json');
 await rm(file);await symlink(join(root,'assets','lantern','painting.json'),file);
 await assert.rejects(session.status('lantern'),/VISION_SESSION_REJECTED/);
 await assert.rejects(session.begin('lantern',{brief:'Refuse symlink',size:64,environment:'twilight',maxIterations:2}),/VISION_SESSION_REJECTED/);
}));
test('crash between paint journal and session journal reconciles exact matching operation once',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Refine focal silhouette',size:64,environment:'twilight',maxIterations:2});
 await session.observe('lantern',{expectedVersion:0});
 const saved=session.save.bind(session);
 let injected=false;
 session.save=async(id,value,opts)=>{
   if(!injected&&value.phase==='NEEDS_OBSERVATION'&&value.version===2){
     injected=true;throw Error('INJECTED_SESSION_FSYNC_FAILURE');
   }
   return saved(id,value,opts);
 };
 await assert.rejects(session.decide('lantern',{expectedVersion:1,observationSha256:SHA,
  decision:'REVISE',critique:'Increase contrast along the flame edge',operations:strokes()}),/INJECTED_SESSION_FSYNC_FAILURE/);
 session.save=saved;
 assert.equal((await paint.load('lantern')).revision,1);
 const recovered=await session.status('lantern');
 assert.equal(recovered.phase,'NEEDS_OBSERVATION');
 assert.equal(recovered.iteration,1);
 assert.equal(recovered.version,2);
 assert.equal((await paint.load('lantern')).revision,1);
}));
test('interrupted pre-paint intent resumes safely without applying phantom operations',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Improve contrast over scenery',size:64,environment:'twilight',maxIterations:2});
 await session.observe('lantern',{expectedVersion:0});
 const saved=session.save.bind(session);
 let injected=false;
 session.save=async(id,value,opts)=>{
   if(!injected&&value.phase==='MUTATING'){
     injected=true;await saved(id,value,opts);throw Error('INJECTED_CRASH_BEFORE_PAINT');
   }
   return saved(id,value,opts);
 };
 await assert.rejects(session.decide('lantern',{expectedVersion:1,observationSha256:SHA,
  decision:'REVISE',critique:'Adjust center glow',operations:strokes()}),/INJECTED_CRASH_BEFORE_PAINT/);
 session.save=saved;
 assert.equal((await paint.load('lantern')).revision,0);
 const recovered=await session.status('lantern');
 assert.equal(recovered.phase,'AWAITING_CRITIQUE');
 assert.equal(recovered.version,1);
 assert.equal((await paint.load('lantern')).revision,0);
}));
test('out-of-band paint edit during pending critique blocks stale AI mutation',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Fix glow contrast',size:64,environment:'twilight',maxIterations:2});
 await session.observe('lantern',{expectedVersion:0});
 await paint.apply('lantern',{expectedRevision:0,operations:strokes()});
 await assert.rejects(session.decide('lantern',{expectedVersion:1,observationSha256:SHA,
  decision:'REVISE',critique:'Out-of-band edits must not be silently incorporated',operations:strokes()}),/VISION_SESSION_REJECTED/);
 await assert.rejects(session.status('lantern'),/VISION_SESSION_REJECTED/);
 assert.equal((await paint.load('lantern')).revision,1);
}));
test('concurrent host decisions cannot spend one observation twice',async()=>sandbox(async({session,paint})=>{
 await session.begin('lantern',{brief:'Improve silhouette readability',size:64,environment:'twilight',maxIterations:3});
 await session.observe('lantern',{expectedVersion:0});
 const payload={expectedVersion:1,observationSha256:SHA,decision:'REVISE',
  critique:'Separate silhouette and strengthen the light rim',operations:strokes()};
 const results=await Promise.allSettled([session.decide('lantern',payload),session.decide('lantern',payload)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal((await paint.load('lantern')).revision,1);
 assert.equal((await session.status('lantern')).iteration,1);
}));
test('checkpoint rights forgery and illegal brief settings fail closed',async()=>sandbox(async({session,root})=>{
 for(const o of [
  {brief:'short',size:64,environment:'twilight',maxIterations:1},
  {brief:'Well formed art brief',size:2048,environment:'twilight',maxIterations:1},
  {brief:'Well formed art brief',size:64,environment:'forbidden',maxIterations:1},
  {brief:'Well formed art brief',size:64,environment:'moonlight',maxIterations:99}
 ])await assert.rejects(session.begin('lantern',o),/VISION_SESSION_REJECTED/);
 await session.begin('lantern',{brief:'Well formed art brief',size:64,environment:'twilight',maxIterations:1});
 const file=join(root,'assets','lantern','vision-session.json');
 const {readFile,writeFile}=await import('node:fs/promises');
 const j=JSON.parse(await readFile(file,'utf8'));
 j.rightsVerified=true;
 await writeFile(file,JSON.stringify(j));
 await assert.rejects(session.status('lantern'),/VISION_SESSION_REJECTED/);
}));
test('same asset cannot silently erase a prior session audit',async()=>sandbox(async({session})=>{
 const input={brief:'Well formed light study',size:64,environment:'twilight',maxIterations:1};
 await session.begin('lantern',input);
 await assert.rejects(session.begin('lantern',input),/VISION_SESSION_REJECTED/);
}));
