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
