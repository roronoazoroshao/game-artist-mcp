/**
 * Source-agnostic extraction of the deterministic decoded-frame pixel delta
 * and temporal-summary logic prototyped in the R9d-07 technical QA.
 *
 * NO source artwork, provider evidence, rights grant, render side effects,
 * file system access, decoder or exported asset is included.
 */
const fail=reason=>{throw Error('TEMPORAL_FRAME_REJECTED: '+reason)};
const MAX_SIDE=2048,MAX_FRAMES=1000,MAX_TOTAL_PIXELS=32*1024*1024;
function checked(frame){
 if(!frame||typeof frame!=='object'||
    !Number.isSafeInteger(frame.width)||!Number.isSafeInteger(frame.height)||
    frame.width<1||frame.height<1||
    frame.width>MAX_SIDE||frame.height>MAX_SIDE||
    !(frame.data instanceof Uint8Array)||
    frame.data.length!==frame.width*frame.height*4)
  fail('invalid or unbounded decoded RGBA frame');
 return frame;
}
function optionsOf(options){
 if(!options||typeof options!=='object'||Array.isArray(options)||
    !Object.keys(options).every(k=>k==='channelThreshold'))
  fail('invalid channel threshold/options');
 const threshold=Object.hasOwn(options,'channelThreshold')?options.channelThreshold:16;
 if(!Number.isSafeInteger(threshold)||threshold<0||threshold>255)
  fail('invalid channel threshold/options');
 return threshold;
}
/** Strict > threshold on the maximum of the four RGBA channel deltas. */
export function compareDecodedFrames(before,after,options={}){
 const a=checked(before),b=checked(after),threshold=optionsOf(options);
 if(a.width!==b.width||a.height!==b.height)
  fail('frame dimensions differ');
 let changedPixels=0,maxChannelDelta=0;
 for(let i=0;i<a.data.length;i+=4){
  const delta=Math.max(
   Math.abs(a.data[i]-b.data[i]),
   Math.abs(a.data[i+1]-b.data[i+1]),
   Math.abs(a.data[i+2]-b.data[i+2]),
   Math.abs(a.data[i+3]-b.data[i+3])
  );
  if(delta>threshold)changedPixels++;
  if(delta>maxChannelDelta)maxChannelDelta=delta;
 }
 return Object.freeze({
  changedPixels,maxChannelDelta,pixelCount:a.width*a.height,threshold
 });
}
/**
 * Computes quantitative frame-to-frame changes and first/last seam on decoded
 * equal-size RGBA frames. Does not measure monitor playback, perceptual quality,
 * source authenticity or commercial rights.
 */
export function summarizeFrameSequence(frames,options={}){
 if(!Array.isArray(frames)||frames.length<2||frames.length>MAX_FRAMES)
  fail('invalid temporal frame count');
 const threshold=optionsOf(options);
 const first=checked(frames[0]);
 // Cap total work even when a caller repeats the same decoded object.
 if(frames.length*first.width*first.height>MAX_TOTAL_PIXELS)
  fail('temporal sequence exceeds aggregate pixel-work budget');
 for(const frame of frames){
  checked(frame);
  if(frame.width!==first.width||frame.height!==first.height)
   fail('temporal sequence frame dimensions differ');
 }
 const adjacentChangedPixels=[];
 for(let i=1;i<frames.length;i++)
  adjacentChangedPixels.push(compareDecodedFrames(frames[i-1],frames[i],{channelThreshold:threshold}).changedPixels);
 const sorted=[...adjacentChangedPixels].sort((a,b)=>a-b);
 const percentile=q=>sorted[Math.floor(q*(sorted.length-1))];
 const seam=compareDecodedFrames(frames.at(-1),first,{channelThreshold:threshold}).changedPixels;
 return Object.freeze({
  status:'TECHNICAL_FRAME_DIFF_ONLY',
  frameCount:frames.length,
  width:first.width,height:first.height,threshold,
  adjacentChangedPixels:Object.freeze(adjacentChangedPixels),
  p95Jump:percentile(.95),
  medianJump:percentile(.5),
  maxJump:sorted.at(-1),
  meanJump:Number((sorted.reduce((a,b)=>a+b,0)/sorted.length).toFixed(6)),
  loopSeamChangedPixels:seam,
  monitorFramePacingVerified:false,
  perceivedAnimationSmoothnessVerified:false,
  artisticReview:'UNSCORED',
  commercialRightsCleared:false,exportAllowed:false
 });
}
