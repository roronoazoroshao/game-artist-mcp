import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const reject=why=>{throw Error('R9D_MOTION_REJECTED: '+why)};
const TIMES=Object.freeze([0,125,375,750,1250,1875]);
const SIZES=Object.freeze([512,128,64]);
const expected=()=>TIMES.flatMap(t=>SIZES.map(s=>'r9d-t-'+String(t).padStart(4,'0')+'-'+s+'.png'));

/**
 * Test exactly 18 genuine captured screenshot PNGs for structure, visibility
 * and temporal change. It intentionally DOES NOT certify visual smoothness,
 * seam stability, production image quality or Adobe usage rights.
 */
export function auditR9dMotionScreenshots({frames,sourceSha256}={}){
 if(!(frames instanceof Map)||frames.size!==TIMES.length*SIZES.length||
    typeof sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceSha256))
   reject('capture inventory or source SHA256 invalid');
 const names=expected();
 if(names.some(n=>!frames.has(n))||
    [...frames.keys()].some(name=>!names.includes(name)))
   reject('unexpected/missing scale or frame time');
 const decoded=new Map(),digests={};
 let assetScaleOccupancy64=null;
 for(const filename of names){
  const match=filename.match(/-(512|128|64)\.png$/),size=Number(match?.[1]);
  let im;
  try{
   const bytes=frames.get(filename);
   if(!Buffer.isBuffer(bytes)||bytes.length<100)reject('missing screenshot bytes');
   im=PNG.sync.read(bytes,{checkCRC:true});
   digests[filename]=createHash('sha256').update(bytes).digest('hex');
  }catch(e){reject('malformed/invalid PNG '+filename+': '+String(e?.message??e).slice(0,60))}
  if(im.width!==size||im.height!==size||im.data.length!==size*size*4)
   reject('invalid framebuffer size '+filename);
  let painted=0,minX=size,minY=size,maxX=-1,maxY=-1;
  const base=im.data.subarray(0,4);
  for(let i=0;i<im.data.length;i+=4){
   const colorChange=Math.max(...Array.from({length:4},(_,k)=>Math.abs(im.data[i+k]-base[k])));
   if(colorChange>16){
    painted++;
    const point=i/4,x=point%size,y=Math.floor(point/size);
    minX=Math.min(minX,x);minY=Math.min(minY,y);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   }
  }
  if(painted<(size===512?100:10))
   reject('flat/missing rendered scene '+filename);
  const bounds={width:maxX-minX+1,height:maxY-minY+1};
  // A 64x64 screenshot of the entire 512px scene shrinks the lantern to a
  // ~20px-wide blob. That is NOT meaningful 64px sprite readability review.
  // Require the fixed authored asset crop to occupy the review frame.
  if((size===64&&(bounds.width<28||bounds.height<42))||
     (size===128&&(bounds.width<60||bounds.height<85)))
   reject('source asset occupies too few pixels for honest 64/128px review '+filename);
  if(filename==='r9d-t-0000-64.png')assetScaleOccupancy64=bounds;
  decoded.set(filename,im);
 }
 const changedPixelPairs=[];
 let significant=0;
 for(let i=1;i<TIMES.length;i++){
  const older='r9d-t-'+String(TIMES[i-1]).padStart(4,'0')+'-512.png';
  const newer='r9d-t-'+String(TIMES[i]).padStart(4,'0')+'-512.png';
  const a=decoded.get(older).data,b=decoded.get(newer).data;
  let changed=0;
  for(let p=0;p<a.length;p+=4){
   if(Math.abs(a[p]-b[p])>16||Math.abs(a[p+1]-b[p+1])>16||
      Math.abs(a[p+2]-b[p+2])>16||Math.abs(a[p+3]-b[p+3])>16)
    changed++;
  }
  if(changed>=25)significant++;
  changedPixelPairs.push(Object.freeze({
   fromMs:TIMES[i-1],toMs:TIMES[i],changedPixels512:changed
  }));
 }
 if(significant<3)reject('animation screenshots are static/insufficiently distinct');
 return Object.freeze({
  status:'TECHNICAL_MULTI_TIME_CAPTURE_ONLY',sourceSha256,
  frameCount:names.length,frameTimesMs:[...TIMES],scales:[...SIZES],
  visibleArtVerified:true,assetScaleOccupancy64:Object.freeze(assetScaleOccupancy64),
  significantTransitions:significant,
  changedPixelPairs:Object.freeze(changedPixelPairs),digests,
  artisticReview:'UNSCORED',providerRightsVerified:false,exportAllowed:false
 });
}


const R9D06_TIMES=Object.freeze([0,1,69,70,95,105,124,125,180,375,750,1250,1875,1945,1999]);
const SHOT=(time,size)=>'r9d-t-'+String(time).padStart(4,'0')+'-'+size+'.png';
const EXACT_FRAMING=JSON.stringify({
 512:'FULL_SCENE',128:'300x300_FIXED_ITEM_CROP',64:'300x300_FIXED_ITEM_CROP'
});
function decodeReviewFrames(frames,label){
 if(!(frames instanceof Map)||frames.size!==R9D06_TIMES.length*SIZES.length)
  reject('R9d-06 '+label+' screenshot count mismatch');
 const decoded=new Map(),sha256={};
 for(const t of R9D06_TIMES)for(const size of SIZES){
  const name=SHOT(t,size),bytes=frames.get(name);
  if(!Buffer.isBuffer(bytes)||bytes.length<100)reject('missing/invalid '+label+' screenshot '+name);
  let img;
  try{img=PNG.sync.read(bytes,{checkCRC:true})}
  catch{reject('bad PNG CRC/data '+label+' '+name)}
  if(img.width!==size||img.height!==size||
     img.data.length!==size*size*4)reject('invalid screenshot dimension '+name);
  let glow=0,xsum=0,ysum=0,lit=0,x0=size,y0=size,x1=-1,y1=-1;
  const background=img.data.subarray(0,4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=4*(y*size+x),r=img.data[i],g=img.data[i+1],
    b=img.data[i+2],a=img.data[i+3];
   if(g>r+25&&b>r+25&&a>=70){
    glow++;xsum+=x;ysum+=y;lit+=.2126*r+.7152*g+.0722*b;
   }
   if(Math.max(Math.abs(r-background[0]),Math.abs(g-background[1]),
      Math.abs(b-background[2]),Math.abs(a-background[3]))>16){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
   }
  }
  if(x1<0||y1<0)reject('flat/no scene at '+name);
  if((size===64&&(x1-x0+1<28||y1-y0+1<42))||
     (size===128&&(x1-x0+1<60||y1-y0+1<85)))
   reject('item crop unreadably small '+name);
  decoded.set(name,{img,glow,center:glow?{x:xsum/glow,y:ysum/glow}:null,
   meanLuminance:glow?lit/glow:0,visibleBounds:[x0,y0,x1,y1]});
  sha256[name]=createHash('sha256').update(bytes).digest('hex');
 }
 const distinct=new Set(R9D06_TIMES.map(t=>sha256[SHOT(t,512)]));
 if(distinct.size<3)reject('static/loop-stuck '+label+' renders');
 return {decoded,sha256};
}
function changedPixelCount(imgA,imgB){
 const a=imgA.data,b=imgB.data;
 if(a.length!==b.length)reject('pixel size mismatch');
 let changed=0,totalAbs=0;
 for(let i=0;i<a.length;i+=4){
  const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),
   Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]));
  if(d>16)changed++;
  totalAbs+=d;
 }
 return {changedPixels:changed,meanChannelMaxDelta:totalAbs/(a.length/4)};
}
/**
 * A factual audit over independently captured baseline and hybrid PNGs.
 * Matching camera/crop/engine is guaranteed by the CI capture workflow, not
 * inferred from the PNG bytes. A passing structure/geometry audit is NEVER
 * a human visual quality or commercial rights approval.
 */
export function auditR9d06TransitionComparison({baselineFrames,candidateFrames,metadata}={}){
 if(!metadata||typeof metadata!=='object'||
    typeof metadata.sourceSha256!=='string'||
    !/^[0-9a-f]{64}$/.test(metadata.sourceSha256)||
    metadata.engineVersion!=='4.7.2-stable'||
    JSON.stringify(metadata.camera)!=='[512,512]'||
    JSON.stringify(metadata.crop)!=='[106,75,300,300]'||
    JSON.stringify(metadata.framesByScale)!==EXACT_FRAMING||
    JSON.stringify(metadata.timesMs)!==JSON.stringify(R9D06_TIMES))
   reject('R9d-06 unverified capture metadata, framing or source hash');
 const b=decodeReviewFrames(baselineFrames,'baseline');
 const c=decodeReviewFrames(candidateFrames,'hybrid');
 const loopSeamComparison={};
 const metrics={baseline:{},candidate:{}};
 for(const size of SIZES){
  const before=b.decoded.get(SHOT(1999,size)).img,
   after=b.decoded.get(SHOT(0,size)).img;
  const candidateBefore=c.decoded.get(SHOT(1999,size)).img,
   candidateAfter=c.decoded.get(SHOT(0,size)).img;
  loopSeamComparison[size]={
   baselineChangedPixels:changedPixelCount(before,after).changedPixels,
   candidateChangedPixels:changedPixelCount(candidateBefore,candidateAfter).changedPixels
  };
  for(const [group,key] of [[b,'baseline'],[c,'candidate']]){
   const entries=R9D06_TIMES.map(time=>{
    const img=group.decoded.get(SHOT(time,size));
    return {timeMs:time,cyanPixelCount:img.glow,
     cyanCentroid:img.center,cyanMeanLuminance:img.meanLuminance,
     visibleBounds:img.visibleBounds,sha256:group.sha256[SHOT(time,size)]};
   });
   metrics[key][size]=entries;
  }
 }
 return Object.freeze({
  status:'MEASURED_REAL_FRAME_COMPARISON_ART_UNSCORED',
  framesPerVariant:R9D06_TIMES.length*SIZES.length,
  sourceSha256:metadata.sourceSha256,
  engineVersion:metadata.engineVersion,
  crop:metadata.crop,
  timesMs:[...R9D06_TIMES],scales:[...SIZES],
  loopSeamComparison,perFrameMetrics:metrics,
  screenshotSha256s:{baseline:b.sha256,candidate:c.sha256},
  loopSeamSubjectiveRating:'NOT_SCORED',
  gameplayAnimationSmoothnessVerified:false,
  artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false
 });
}
