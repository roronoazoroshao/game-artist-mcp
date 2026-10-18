import test from 'node:test';
import assert from 'node:assert/strict';
import {compareDecodedFrames,summarizeFrameSequence} from '../src/ai-art/temporal-frame-diff.mjs';

const image=(w=64,h=64)=>({width:w,height:h,data:new Uint8Array(w*h*4)});
const copy=a=>({width:a.width,height:a.height,data:Uint8Array.from(a.data)});
const color=(a,x,y,rgba)=>{a.data.set(rgba,4*(y*a.width+x));return a};

test('technical pixel diff uses max RGBA channel delta, strict >16 threshold, no art signoff',()=>{
 const a=image(),b=copy(a);
 color(b,3,2,[16,0,0,0]);
 assert.equal(compareDecodedFrames(a,b).changedPixels,0);
 color(b,3,2,[17,0,0,0]);
 const d=compareDecodedFrames(a,b);
 assert.equal(d.changedPixels,1);
 assert.equal(d.maxChannelDelta,17);
 assert.equal(d.pixelCount,4096);
 assert.equal(d.threshold,16);
});
test('technical full-loop 120Hz metrics are deterministic and report seam without claiming screen frame-pacing',()=>{
 const a=image(32,32),b=copy(a),c=copy(a),d=copy(a);
 color(b,0,0,[32,0,0,0]);
 color(c,0,0,[32,0,0,0]);color(c,1,1,[32,0,0,0]);
 color(d,0,0,[32,0,0,0]);color(d,1,1,[32,0,0,0]);color(d,2,2,[32,0,0,0]);
 const metrics=summarizeFrameSequence([a,b,c,d]);
 assert.deepEqual(metrics.adjacentChangedPixels,[1,1,1]);
 assert.equal(metrics.p95Jump,1);
 assert.equal(metrics.maxJump,1);
 assert.equal(metrics.loopSeamChangedPixels,3);
 assert.equal(metrics.artisticReview,'UNSCORED');
 assert.equal(metrics.monitorFramePacingVerified,false);
 assert.equal(metrics.exportAllowed,false);
});
test('fail closed on dimensions, threshold, oversized arrays and corrupt data',()=>{
 const a=image(),bad=copy(a);
 for(const args of [
  [a,image(32,32)],
  [a,{width:64,height:64,data:new Uint8Array(10)}],
  [a,{width:4096,height:4096,data:new Uint8Array(5)}],
  [a,{width:64,height:64,data:[0]}],
 ])assert.throws(()=>compareDecodedFrames(...args),/TEMPORAL_FRAME_REJECTED/);
 for(const value of [-1,256,1.5,NaN,'16'])assert.throws(()=>compareDecodedFrames(a,bad,{channelThreshold:value}),/TEMPORAL_FRAME_REJECTED/);
 assert.throws(()=>summarizeFrameSequence([a]),/TEMPORAL_FRAME_REJECTED/);
 assert.throws(()=>summarizeFrameSequence([a,bad],{channelThreshold:-2}),/TEMPORAL_FRAME_REJECTED/);
});


test('aggregate temporal pixel budget prevents quadratic CPU/memory abuse',()=>{
 const large=image(1024,1024);
 assert.throws(()=>summarizeFrameSequence(Array(40).fill(large)),/TEMPORAL_FRAME_REJECTED/);
 assert.throws(()=>compareDecodedFrames(image(),image(),{channelThreshold:null}),/TEMPORAL_FRAME_REJECTED/);
});
