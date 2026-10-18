import pngjs from 'pngjs';
import {inspectAiPng} from './png-intake.mjs';
const {PNG}=pngjs;
const fail=reason=>{throw Error('R9D_POSE_REJECTED: '+reason)};
const POSES=['flame_a','flame_b','flame_c','flame_d'];
const SAMPLE_W=48,SAMPLE_H=64;
const MIN_DISTANCE=0.05;

function percentileBin(counts,total,q){
 const target=total*q;
 let cumulative=0;
 for(let i=0;i<counts.length;i++){
  cumulative+=counts[i];
  if(cumulative>=target)return i;
 }
 return counts.length-1;
}
function normalizedAlphaMask(bytes){
 const meta=inspectAiPng(bytes);
 const p=PNG.sync.read(bytes,{checkCRC:true});
 const cols=new Uint32Array(meta.width),rows=new Uint32Array(meta.height);
 let occupied=0;
 for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){
  if(p.data[4*(y*meta.width+x)+3]>=96){
   occupied++;cols[x]++;rows[y]++;
  }
 }
 if(occupied<64||occupied/(meta.width*meta.height)<0.001)
  fail('empty or tiny visible flame silhouette');
 // Ignore isolated alpha flecks when establishing bounds. A one-pixel noise
 // mutation must not transform the apparent shape by changing the bbox.
 const x0=percentileBin(cols,occupied,0.01);
 const x1=percentileBin(cols,occupied,0.99);
 const y0=percentileBin(rows,occupied,0.01);
 const y1=percentileBin(rows,occupied,0.99);
 if(x1-x0<6||y1-y0<6)fail('invalid flame bounds');
 const mask=new Uint8Array(SAMPLE_W*SAMPLE_H);
 for(let y=0;y<SAMPLE_H;y++)for(let x=0;x<SAMPLE_W;x++){
  const sx=Math.max(0,Math.min(meta.width-1,Math.floor(x0+(x+0.5)*(x1-x0+1)/SAMPLE_W)));
  const sy=Math.max(0,Math.min(meta.height-1,Math.floor(y0+(y+0.5)*(y1-y0+1)/SAMPLE_H)));
  mask[y*SAMPLE_W+x]=p.data[4*(sy*meta.width+sx)+3]>=96?1:0;
 }
 return mask;
}
function difference(a,b){
 let xor=0;
 for(let i=0;i<a.length;i++)if(a[i]!==b[i])xor++;
 return xor/a.length;
}
/**
 * Source byte guard for four independently authored flame silhouettes.
 * This is a technical distinct-pose check, NEVER a professional judgement
 * of stylistic coherence, smooth animation, originality or license.
 */
export function inspectR9dFlamePoseSet(pngByPose){
 if(!(pngByPose instanceof Map)||pngByPose.size!==POSES.length||
   POSES.some(id=>!pngByPose.has(id)))fail('four canonical flame poses required');
 const masks=POSES.map(id=>normalizedAlphaMask(pngByPose.get(id)));
 const adjacentDifferences=[];
 for(let i=0;i<POSES.length;i++){
  const next=(i+1)%POSES.length;
  const distance=difference(masks[i],masks[next]);
  adjacentDifferences.push(Object.freeze({
   from:POSES[i],to:POSES[next],distance
  }));
  if(distance<MIN_DISTANCE)
   fail('flame poses have indistinguishable normalized alpha shapes');
 }
 return Object.freeze({
  ok:true,status:'TECHNICAL_POSE_VARIANCE_ONLY',poses:Object.freeze([...POSES]),
  adjacentDifferences:Object.freeze(adjacentDifferences),
  threshold:MIN_DISTANCE,artisticReview:'UNSCORED',rigAligned:false,
  commercialRightsCleared:false,exportAllowed:false
 });
}
