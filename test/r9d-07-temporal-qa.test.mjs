import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {auditR9d07DenseTemporalFrames} from '../src/ai-art/r9d-07-temporal-qa.mjs';
const {PNG}=pngjs;
const SHA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const config={sourceOraSha256:SHA,sampleRateHz:120,durationSeconds:2,
 cropRect:[106,75,300,300],sizes:[64,128],engineVersion:'4.7.2-stable'};
function paint(size,tick,staticFrames=false){
 const image=new PNG({width:size,height:size,colorType:6});
 const phase=staticFrames?0:tick%8;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const q=4*(y*size+x);
  const bright=x>size*.2+phase&&x<size*.7+phase&&y>=size*.1&&y<=size*.95;
  image.data[q]=bright?50:24;image.data[q+1]=bright?205:28;
  image.data[q+2]=bright?213:30;image.data[q+3]=255;
 }
 return PNG.sync.write(image);
}
function fixture(staticFrames=false){
 const frames=new Map();
 for(let i=0;i<240;i++){
  frames.set('tick-'+String(i).padStart(4,'0')+'-64.png',paint(64,i,staticFrames));
  if(i%2===0)frames.set('tick-'+String(i).padStart(4,'0')+'-128.png',paint(128,i,staticFrames));
 }
 return frames;
}
test('R9d-07 dense temporal QA measures 120Hz ticks and true 60Hz subset without claiming artistic GO',()=>{
 const base=fixture(),candidate=fixture();
 const result=auditR9d07DenseTemporalFrames({
  baselineFrames:base,candidateFrames:candidate,metadata:config
 });
 assert.equal(result.frameCountPerVariant,360);
 assert.equal(result.sampling,'DETERMINISTIC_GODOT_120HZ_SEEK_NOT_PHYSICAL_MONITOR_FPS');
 assert.equal(result.variants.candidate.adjacent64.length,239);
 assert.equal(result.variants.candidate.adjacent128.length,119);
 assert.ok(result.variants.candidate.maxJump64>=0);
 assert.equal(result.artisticReview,'UNSCORED');
 assert.equal(result.exportAllowed,false);
});
test('R9d-07 dense temporal QA rejects missing frames, altered source and static animation',()=>{
 const frames=fixture(),missing=fixture();
 missing.delete('tick-0170-64.png');
 assert.throws(()=>auditR9d07DenseTemporalFrames({
  baselineFrames:frames,candidateFrames:missing,metadata:config
 }),/R9D07_TEMPORAL_REJECTED/);
 assert.throws(()=>auditR9d07DenseTemporalFrames({
  baselineFrames:frames,candidateFrames:frames,
  metadata:{...config,sourceOraSha256:'1'.repeat(64)}
 }),/R9D07_TEMPORAL_REJECTED/);
 const still=fixture(true);
 assert.throws(()=>auditR9d07DenseTemporalFrames({
  baselineFrames:still,candidateFrames:still,metadata:config
 }),/R9D07_TEMPORAL_REJECTED/);
});
