import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const fail=why=>{throw Error('R9D07_TEMPORAL_REJECTED: '+why)};
const SHA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const filename=(tick,size)=>'tick-'+String(tick).padStart(4,'0')+'-'+size+'.png';
const num=(a,b)=>Number((a/b).toFixed(6));
const pct=(sorted,q)=>sorted[Math.floor(q*(sorted.length-1))];
function countDifferent(a,b){
 if(!a||!b||a.data.length!==b.data.length)fail('unmatched framebuffer dimensions');
 let count=0;let max=0;
 for(let i=0;i<a.data.length;i+=4){
  const d=Math.max(Math.abs(a.data[i]-b.data[i]),
   Math.abs(a.data[i+1]-b.data[i+1]),
   Math.abs(a.data[i+2]-b.data[i+2]),
   Math.abs(a.data[i+3]-b.data[i+3]));
  if(d>16)count++;
  if(d>max)max=d;
 }
 return {changedPixels:count,maxChannelDelta:max};
}
function auditVariant(frames,label){
 if(!(frames instanceof Map)||frames.size!==360)
  fail('missing/extra real screenshot frame in '+label);
 const frames64=[],frames128=[],digests={};
 for(let i=0;i<240;i++){
  for(const size of (i%2===0?[64,128]:[64])){
   const key=filename(i,size),bytes=frames.get(key);
   if(!Buffer.isBuffer(bytes)||bytes.length<100)fail('missing PNG '+label+' '+key);
   let png;
   try{png=PNG.sync.read(bytes,{checkCRC:true})}
   catch{fail('corrupt PNG '+label+' '+key)}
   if(png.width!==size||png.height!==size||png.data.length!==4*size*size)
    fail('wrong frame dimensions '+label+' '+key);
   const sha=createHash('sha256').update(bytes).digest('hex');
   digests[key]=sha;
   if(size===64)frames64.push(png);
   else frames128.push(png);
  }
 }
 const aggregate=array=>{
  const jumps=[];
  for(let i=1;i<array.length;i++){
   const p=countDifferent(array[i-1],array[i]);
   jumps.push(p.changedPixels);
  }
  const seam=countDifferent(array.at(-1),array[0]).changedPixels;
  const sorted=[...jumps].sort((a,b)=>a-b);
  return {jumps,p95Jump:pct(sorted,.95),
   medianJump:pct(sorted,.5),maxJump:sorted.at(-1),
   meanJump:num(jumps.reduce((a,b)=>a+b,0),jumps.length),
   loopSeamChangedPixels:seam};
 };
 if(new Set(frames64.map((f,i)=>digests[filename(i,64)])).size<10)
  fail('static or repeated frame sequence '+label);
 const small=aggregate(frames64),large=aggregate(frames128);
 return {adjacent64:small.jumps,adjacent128:large.jumps,
  maxJump64:small.maxJump,maxJump128:large.maxJump,
  p95Jump64:small.p95Jump,p95Jump128:large.p95Jump,
  meanJump64:small.meanJump,meanJump128:large.meanJump,
  medianJump64:small.medianJump,medianJump128:large.medianJump,
  loopSeamChangedPixels64:small.loopSeamChangedPixels,
  loopSeamChangedPixels128:large.loopSeamChangedPixels,
  fullFrameSHA256:digests};
}
/**
 * Actual Godot frame-seek samples spaced at 1/120s; even 128px frames form
 * a 60Hz subset. This audits bitmap motion, NOT monitor refresh pacing or
 * human-perceived art smoothness. Original R9d painted source is immutable.
 */
export function auditR9d07DenseTemporalFrames({baselineFrames,candidateFrames,metadata}={}){
 if(!metadata||metadata.sourceOraSha256!==SHA||
  metadata.sampleRateHz!==120||metadata.durationSeconds!==2||
  metadata.engineVersion!=='4.7.2-stable'||
  JSON.stringify(metadata.cropRect)!=='[106,75,300,300]'||
  JSON.stringify(metadata.sizes)!=='[64,128]')
  fail('untrusted capture contract/source');
 const baseline=auditVariant(baselineFrames,'R9D06_BASELINE');
 const candidate=auditVariant(candidateFrames,'R9D07_POLISHED');
 return Object.freeze({
  status:'DENSE_TEMPORAL_TECHNICAL_METRICS_UNSCORED',
  sourceOraSha256:SHA,
  sampling:'DETERMINISTIC_GODOT_120HZ_SEEK_NOT_PHYSICAL_MONITOR_FPS',
  sampleRateHz:120,
  frameCountPerVariant:360,
  effectiveFPS128:60,temporalDurationSeconds:2,
  fixedCrop:{x:106,y:75,width:300,height:300},
  variants:{baseline,candidate},
  quantifiedDoubleEdgeReduction:'NOT_PROVEN_BY_FRAME_DIFFS',
  perceivedAnimationSmoothnessVerified:false,
  artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false
 });
}

/**
 * Explicit technical 64px regression bound, independent of ARTISTIC_GO.
 * Accept a bounded +8 changed pixels on 4096-pixel images relative to the
 * frozen source-identical R9d-06 baseline. This is not a perceptual score.
 */
export function assertR9d07TemporalStability({baseline,candidate}={}){
 const safe=x=>x&&['p95Jump64','maxJump64'].every(k=>
  Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=4096);
 if(!safe(baseline)||!safe(candidate)||
    baseline.p95Jump64>baseline.maxJump64||
    candidate.p95Jump64>candidate.maxJump64)
  fail('invalid measured baseline or candidate');
 const MAX_EXTRA_PIXELS=8;
 if(candidate.p95Jump64>baseline.p95Jump64+MAX_EXTRA_PIXELS||
    candidate.maxJump64>baseline.maxJump64+MAX_EXTRA_PIXELS)
  fail('measured 64px temporal pop exceeds frozen R9d-06 +8px bound');
 return Object.freeze({
  status:'BOUNDED_64PX_TEMPORAL_TECHNICAL_ONLY',
  boundExtraPixels:MAX_EXTRA_PIXELS,
  baselineP95Jump64:baseline.p95Jump64,
  candidateP95Jump64:candidate.p95Jump64,
  baselineMaxJump64:baseline.maxJump64,
  candidateMaxJump64:candidate.maxJump64,
  artisticReview:'UNSCORED',exportAllowed:false
 });
}
