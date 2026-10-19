import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace,renderPaint} from '../src/ai-art/paint-workstation.mjs';
import {ArtistVisionSession} from '../src/ai-art/vision-session.mjs';
const {PNG}=pngjs;
const digest=b=>createHash('sha256').update(b).digest('hex');
function makeCapture(p,opts){
 const bitmap=new PNG({width:opts.size,height:opts.size});
 const sample=p.revision*80+10;
 for(let i=0;i<bitmap.data.length;i+=4){bitmap.data[i]=sample;bitmap.data[i+1]=70;bitmap.data[i+2]=140;bitmap.data[i+3]=255;}
 const png=PNG.sync.write(bitmap);
 return {png,sha256:digest(png),sourcePaintSha256:renderPaint(p,{revision:opts.revision}).sha256,
   engine:'REAL_GODOT_FRAMEBUFFER',scene:'DETERMINISTIC_ART_STAGING_FIXTURE',
   environment:opts.environment,size:opts.size,revision:opts.revision,
   artisticReview:'UNSCORED',exportAllowed:false,rightsVerified:false};
}
const stroke=[{type:'stroke.draw',layerId:'base',color:'#88dddd',radius:4,opacity:.8,points:[[12,12,1],[20,20,1]]}];
async function setup(cb){
 const root=await mkdtemp(join(tmpdir(),'artist-web-v5-'));
 try{
  const store=new AssetStore(root);
  await store.create('lantern',64,64);
  const paint=new PaintWorkspace(store);await paint.open('lantern');
  const observer={async observe(asset,options){return makeCapture(await paint.load(asset),options)}};
  const session=new ArtistVisionSession({paint,observer});
  await cb({root,store,paint,observer,session});
 }finally{await rm(root,{recursive:true,force:true})}
}
const opts={brief:'Make flame brighter in the Godot staging shot',size:64,environment:'twilight',maxIterations:2};

test('ChatGPT Web returns the exact original Godot screenshot after a new chat/restarted controller',async()=>setup(async({root,session,paint,observer})=>{
 await session.begin('lantern',opts);
 const observed=await session.observe('lantern',{expectedVersion:0});
 const newProcessSession=new ArtistVisionSession({paint,observer});
 const again=await newProcessSession.reinspect('lantern',{expectedVersion:1});
 assert.deepEqual(again.png,observed.png);
 assert.equal(again.observationSha256,observed.observationSha256);
 assert.equal(again.version,1);
 assert.equal(again.brief,opts.brief);
 assert.equal(again.artisticReview,'UNSCORED');
 assert.equal(again.rightsVerified,false);
 assert.equal(again.exportAllowed,false);
 const status=await newProcessSession.status('lantern');
 assert.equal(status.version,1);
 assert.equal(status.phase,'AWAITING_CRITIQUE');
}));
test('revision changes seal distinct frames, reuse of stale screenshot is forbidden',async()=>setup(async({session})=>{
 await session.begin('lantern',opts);
 const first=await session.observe('lantern',{expectedVersion:0});
 await session.decide('lantern',{expectedVersion:1,observationSha256:first.observationSha256,
   decision:'REVISE',critique:'Add visible flame glow near the center',operations:stroke});
 await assert.rejects(session.reinspect('lantern',{expectedVersion:1}),/VISION_SESSION_REJECTED/);
 const second=await session.observe('lantern',{expectedVersion:2});
 const restored=await session.reinspect('lantern',{expectedVersion:3});
 assert.equal(restored.observationSha256,second.observationSha256);
 assert.notEqual(restored.observationSha256,first.observationSha256);
 await assert.rejects(session.decide('lantern',{expectedVersion:3,observationSha256:first.observationSha256,
  decision:'FINISH',critique:'Do not accept old screenshot as the new one'}),/VISION_SESSION_REJECTED/);
 await session.decide('lantern',{expectedVersion:3,observationSha256:second.observationSha256,
  decision:'FINISH',critique:'Ready for human assessment, not automatically approved'});
 await assert.rejects(session.reinspect('lantern',{expectedVersion:4}),/VISION_SESSION_REJECTED/);
}));
test('refuses tampered, truncated and symlinked persisted observation snapshots',async()=>setup(async({root,session})=>{
 await session.begin('lantern',opts);
 const first=await session.observe('lantern',{expectedVersion:0});
 const path=join(root,'assets','lantern','vision-observations',first.observationSha256+'.png');
 await writeFile(path,'tampered screenshot');
 await assert.rejects(session.reinspect('lantern',{expectedVersion:1}),/VISION_SESSION_REJECTED/);
 await writeFile(path,first.png);
 await session.reinspect('lantern',{expectedVersion:1});
 await rm(path);
 await symlink(join(root,'assets','lantern','painting.json'),path);
 await assert.rejects(session.reinspect('lantern',{expectedVersion:1}),/VISION_SESSION_REJECTED/);
}));
test('pending critique created in legacy V4 without snapshot fails closed; never silently recaptures',async()=>setup(async({root,session})=>{
 await session.begin('lantern',opts);
 const shot=await session.observe('lantern',{expectedVersion:0});
 await rm(join(root,'assets','lantern','vision-observations',shot.observationSha256+'.png'));
 await assert.rejects(session.reinspect('lantern',{expectedVersion:1}),/VISION_SESSION_REJECTED/);
 assert.equal((await session.status('lantern')).phase,'AWAITING_CRITIQUE');
}));
test('cannot reinspect before first capture or after version mismatch',async()=>setup(async({session})=>{
 await session.begin('lantern',opts);
 await assert.rejects(session.reinspect('lantern',{expectedVersion:0}),/VISION_SESSION_REJECTED/);
 await session.observe('lantern',{expectedVersion:0});
 await assert.rejects(session.reinspect('lantern',{expectedVersion:0}),/VISION_SESSION_REJECTED/);
 await assert.rejects(session.reinspect('lantern',{expectedVersion:100}),/VISION_SESSION_REJECTED/);
}));
