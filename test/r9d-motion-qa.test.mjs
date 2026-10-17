import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {auditR9dMotionScreenshots} from '../src/ai-art/r9d-motion-qa.mjs';
const {PNG}=pngjs;
const TIMES=[0,125,375,750,1250,1875];
const SIZES=[512,128,64];
function screenshot(size,pose,tiny=false){
 const p=new PNG({width:size,height:size,colorType:6});
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=4*(y*size+x),lit=tiny?
   x>=size*0.40+pose&&x<size*0.56+pose&&y>=size*0.32&&y<size*0.64:
   x>=size*0.16+pose&&x<size*0.78+pose&&y>=size*0.08&&y<size*0.94;
  p.data.set(lit?[20,235,234,255]:[40,42,46,255],i);
 }
 return PNG.sync.write(p);
}
function sample(){
 return new Map(TIMES.flatMap((t,i)=>SIZES.map(size=>[
  'r9d-t-'+String(t).padStart(4,'0')+'-'+size+'.png',
  screenshot(size,i%4)
 ])));
}
test('R9d-05 motion QA requires 6 sampled timestamps x 512/128/64 actual PNG frames',()=>{
 const r=auditR9dMotionScreenshots({frames:sample(),sourceSha256:'a'.repeat(64)});
 assert.equal(r.status,'TECHNICAL_MULTI_TIME_CAPTURE_ONLY');
 assert.equal(r.frameCount,18);
 assert.equal(r.visibleArtVerified,true);
 assert.ok(r.assetScaleOccupancy64.width>=28);
 assert.ok(r.assetScaleOccupancy64.height>=42);
 assert.equal(r.artisticReview,'UNSCORED');
 assert.equal(r.exportAllowed,false);
 assert.ok(r.changedPixelPairs.length===5);
});
test('R9d-05 motion QA rejects missing render scales and a static two-second pose',()=>{
 const f=sample();f.delete('r9d-t-0375-64.png');
 assert.throws(()=>auditR9dMotionScreenshots({frames:f,sourceSha256:'a'.repeat(64)}),/R9D_MOTION_REJECTED/);
 const still=new Map(TIMES.flatMap(t=>SIZES.map(size=>[
  'r9d-t-'+String(t).padStart(4,'0')+'-'+size+'.png',screenshot(size,0)
 ])));
 assert.throws(()=>auditR9dMotionScreenshots({frames:still,sourceSha256:'a'.repeat(64)}),/R9D_MOTION_REJECTED/);
});
test('R9d-05 motion QA rejects corrupted screenshot, unexpected frame and false source hash',()=>{
 const bad=sample();bad.set('r9d-t-0000-512.png',Buffer.from('invalid'));
 assert.throws(()=>auditR9dMotionScreenshots({frames:bad,sourceSha256:'a'.repeat(64)}),/R9D_MOTION_REJECTED/);
 assert.throws(()=>auditR9dMotionScreenshots({frames:sample(),sourceSha256:'not SHA'}),/R9D_MOTION_REJECTED/);
 const extra=sample();extra.set('r9d-t-9999-512.png',screenshot(512,0));
 assert.throws(()=>auditR9dMotionScreenshots({frames:extra,sourceSha256:'a'.repeat(64)}),/R9D_MOTION_REJECTED/);
});

test('R9d-05 review thumbnails cannot present a 10px-wide full-scene reduction as 64px item readability',()=>{
 const tiny=new Map(TIMES.flatMap((t,i)=>SIZES.map(size=>[
  'r9d-t-'+String(t).padStart(4,'0')+'-'+size+'.png',
  screenshot(size,i%4,true)
 ])));
 assert.throws(()=>auditR9dMotionScreenshots({frames:tiny,sourceSha256:'a'.repeat(64)}),/R9D_MOTION_REJECTED/);
});
