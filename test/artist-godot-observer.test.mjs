import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {AssetStore} from '../src/mcp/store.mjs';
import {PaintWorkspace} from '../src/ai-art/paint-workstation.mjs';
import {GodotPaintObserver,measureSceneDifference} from '../src/ai-art/godot-paint-observer.mjs';
const {PNG}=pngjs;
const realGodot=process.env.GAME_ARTIST_RUN_REAL_GODOT==='1';
async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'artist-v3-'));
 try{const store=new AssetStore(root);await store.create('lantern',128,128);
 const paint=new PaintWorkspace(store);await paint.open('lantern');
 await fn({root,paint,observer:new GodotPaintObserver({paint})});
 }finally{await rm(root,{recursive:true,force:true})}
}
test('real Godot framebuffer captures on scene environment, changes with painted revision and palette',{skip:!realGodot},async()=>sandbox(async({paint,observer})=>{
 const first=await paint.load('lantern');
 const second=await paint.apply('lantern',{expectedRevision:0,operations:[{type:'stroke.draw',
   layerId:'base',color:'#7feaff',radius:11,opacity:1,points:[[38,34,1],[63,64,1],[82,88,.7]]}]});
 const base=await observer.observe('lantern',{revision:0,size:128,environment:'twilight'});
 const candidate=await observer.observe('lantern',{revision:1,size:128,environment:'twilight'});
 const moonlight=await observer.observe('lantern',{revision:1,size:128,environment:'moonlight'});
 for(const item of [base,candidate,moonlight]){
  const png=PNG.sync.read(item.png,{checkCRC:true});
  assert.equal(png.width,128);assert.equal(png.height,128);
  assert.match(item.sha256,/^[0-9a-f]{64}$/);
  assert.equal(item.engine,'REAL_GODOT_FRAMEBUFFER');
  assert.equal(item.artisticReview,'UNSCORED');
 }
 assert.notEqual(base.sha256,candidate.sha256);
 assert.notEqual(candidate.sha256,moonlight.sha256);
 assert.ok(measureSceneDifference(base,candidate).changedPixels>0);
 assert.equal(measureSceneDifference(candidate,candidate).changedPixels,0);
 assert.deepEqual(await paint.load('lantern'),second);
}));
test('Godot observer rejects unknown scene settings and missing history before subprocess',async()=>sandbox(async({observer})=>{
 for(const opt of [
  {revision:0,size:33,environment:'twilight'},
  {revision:0,size:128,environment:'../../escape'},
  {revision:5,size:128,environment:'twilight'},
  {revision:0,size:128,environment:'twilight',unused:true},
 ]){
  await assert.rejects(observer.observe('lantern',opt),/GODOT_OBSERVE_REJECTED/);
 }
}));
test('real scene compare validates fixed same environment, no aesthetic release claims',{skip:!realGodot},async()=>sandbox(async({paint,observer})=>{
 await paint.apply('lantern',{expectedRevision:0,operations:[{type:'stroke.draw',
  layerId:'base',color:'#e6bb89',radius:15,opacity:1,points:[[40,40,1],[90,90,.8]]}]});
 const comparison=await observer.compare('lantern',{baselineRevision:0,candidateRevision:1,size:64,environment:'twilight'});
 assert.ok(comparison.changedPixels>0);
 assert.equal(comparison.source,'GODOT_REAL_FRAMEBUFFER');
 assert.equal(comparison.artisticReview,'UNSCORED');
 assert.equal(comparison.rightsVerified,false);
 assert.equal(comparison.exportAllowed,false);
}));
test('external engine unavailable fails closed and next real capture recovers', {skip:!realGodot}, async()=>sandbox(async({paint,observer})=>{
 const broken=new GodotPaintObserver({paint,binary:'/not-a-real-godot-binary'});
 await assert.rejects(broken.observe('lantern',{revision:0,size:64,environment:'twilight'}),/GODOT_OBSERVE_REJECTED/);
 const image=await observer.observe('lantern',{revision:0,size:64,environment:'twilight'});
 assert.equal(image.scene,'DETERMINISTIC_ART_STAGING_FIXTURE');
 assert.equal(image.displayFpsMeasured,false);
 assert.equal(image.png.length>100,true);
}));
test('in-process concurrency is fail-closed rather than launching two Xvfb instances', {skip:!realGodot}, async()=>sandbox(async({observer})=>{
 const first=observer.observe('lantern',{revision:0,size:64,environment:'twilight'});
 await new Promise(resolve=>setTimeout(resolve,200));
 await assert.rejects(observer.observe('lantern',{revision:0,size:64,environment:'twilight'}),/another real scene capture is already running/);
 assert.equal((await first).engine,'REAL_GODOT_FRAMEBUFFER');
}));
test('cannot compare frames from inconsistent staging environments',()=>{
 const stub={engine:'REAL_GODOT_FRAMEBUFFER',size:128,environment:'twilight'};
 assert.throws(()=>measureSceneDifference(stub,{...stub,environment:'moonlight'}),/GODOT_OBSERVE_REJECTED/);
});
