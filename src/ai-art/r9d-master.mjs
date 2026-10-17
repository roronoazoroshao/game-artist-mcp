import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {inspectAiPng} from './png-intake.mjs';
import {writeOpenRaster} from './openraster.mjs';

const {PNG}=pngjs;
const fail=reason=>{throw Error('R9D_MASTER_REJECTED: '+reason)};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ORDER=['body','flame_a','flame_b','flame_c','flame_d','talisman_left','talisman_right','tassel'];
const LAYOUT=Object.freeze({
 body:[124,92,776,870],
 flame_a:[474,520,77,250],
 flame_b:[440,520,144,250],
 flame_c:[481,520,62,250],
 flame_d:[439,520,146,250],
 talisman_left:[232,519,106,387],
 talisman_right:[694,523,103,390],
 tassel:[444,903,144,288]
});
const LEGAL_SHA=/^[0-9a-f]{64}$/;
const authorized=x=>x&&typeof x==='object'&&!Array.isArray(x);

/**
 * Crop to content while retaining weak alpha along anti-aliased edges.
 * Canvas arrangement is an authored first technical-placement proposal, NOT
 * a professional layout approval. No model is used to fake new paint pixels.
 */
function alphaBounds(image){
 const W=image.width,H=image.height;let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const a=image.data[4*(y*W+x)+3];
  if(a>3){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
 }
 if(x1<x0||y1<y0)fail('no painted alpha pixels');
 return {x0:Math.max(0,x0-2),y0:Math.max(0,y0-2),
  x1:Math.min(W,x1+3),y1:Math.min(H,y1+3)};
}
/**
 * Box-area RGBA reconstruction in premultiplied-alpha space. Avoids transparent
 * RGB halos and protects narrow details during source→master downsampling.
 */
function resizeAlphaArea(image,bounds,width,height){
 const {x0,y0,x1,y1}=bounds,sw=x1-x0,sh=y1-y0,W=image.width;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
  width<1||height<1||width*height>1024*1280)fail('invalid layer target bounds');
 const dest=new PNG({width,height,colorType:6});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const ax0=x0+x*sw/width,ax1=x0+(x+1)*sw/width;
  const ay0=y0+y*sh/height,ay1=y0+(y+1)*sh/height;
  let aSum=0,r=0,g=0,b=0;
  for(let sy=Math.floor(ay0);sy<Math.ceil(ay1);sy++){
   const wy=Math.min(sy+1,ay1)-Math.max(sy,ay0);
   if(wy<=0)continue;
   for(let sx=Math.floor(ax0);sx<Math.ceil(ax1);sx++){
    const wx=Math.min(sx+1,ax1)-Math.max(sx,ax0);
    if(wx<=0)continue;
    const p=4*(sy*W+sx),weightedAlpha=image.data[p+3]*wx*wy;
    aSum+=weightedAlpha;
    r+=image.data[p]*weightedAlpha;
    g+=image.data[p+1]*weightedAlpha;
    b+=image.data[p+2]*weightedAlpha;
   }
  }
  const out=4*(y*width+x),area=(ax1-ax0)*(ay1-ay0);
  dest.data[out+3]=Math.min(255,Math.round(aSum/area));
  if(aSum>0){
   dest.data[out]=Math.min(255,Math.round(r/aSum));
   dest.data[out+1]=Math.min(255,Math.round(g/aSum));
   dest.data[out+2]=Math.min(255,Math.round(b/aSum));
  }
 }
 return PNG.sync.write(dest);
}
function derivedAlphaMask(source){
 const image=PNG.sync.read(source,{checkCRC:true});
 const output=new PNG({width:image.width,height:image.height,colorType:6});
 for(let i=0;i<image.data.length;i+=4){
  output.data[i]=255;output.data[i+1]=255;output.data[i+2]=255;
  output.data[i+3]=image.data[i+3];
 }
 return PNG.sync.write(output);
}
/**
 * Convert 8 separate actually Adobe-painted, SHA-frozen PNG bytes to a master
 * ORA and independent derived-alpha mask sidecars.
 * No commercial rights, provider-authenticated original, native mask claims.
 */
export function buildR9dMaster({sourcePngs,custody}={}){
 if(!(sourcePngs instanceof Map)||sourcePngs.size!==8||
    !authorized(custody)||custody.assetId!=='spirit_lantern'||
    custody.provider!=='Adobe Firefly'||custody.storeKind!=='GIT_TRACKED_SOURCE_PNG'||
    custody.sourceAuthentication!=='PROVIDER_URL_UNATTESTED'||
    custody.sourceCount!==8||!Array.isArray(custody.sources)||
    custody.sources.length!==8||custody.rightsVerified!==false||
    custody.rigAligned!==false||custody.artisticReview!=='UNSCORED'||
    custody.exportAllowed!==false||custody.productionReady!==false)
  fail('invalid sources or forged commercial/rig approval');
 const layers=[],sourcePaintings=[],maskPngs=new Map(),bindings=new Map(),ownership=new Map();
 for(let i=0;i<ORDER.length;i++){
  const part=ORDER[i],listed=custody.sources[i];
  const bytes=sourcePngs.get(part);
  if(listed?.partId!==part||!LEGAL_SHA.test(listed.sha256??'')||
     !Buffer.isBuffer(bytes)||sha(bytes)!==listed.sha256||
     listed.bytes!==bytes.length||listed.verifiedPngRgba!==true||
     listed.rigAligned!==false||listed.rightsVerified!==false)
   fail('missing/modified Adobe part source: '+part);
  let meta;
  try{meta=inspectAiPng(bytes)}catch{fail('invalid PNG alpha source: '+part)}
  if(meta.width!==listed.canvas?.[0]||meta.height!==listed.canvas?.[1])
    fail('source canvas mismatch: '+part);
  const image=PNG.sync.read(bytes,{checkCRC:true});
  const rect=LAYOUT[part], [x,y,w,h]=rect;
  if(x<0||y<0||x+w>1024||y+h>1280)fail('layout outside master canvas');
  const framed=resizeAlphaArea(image,alphaBounds(image),w,h);
  const mask=derivedAlphaMask(framed);
  maskPngs.set('masks/'+part+'.png',mask);
  const partId=part.startsWith('flame_')?'flame':part;
  const poseId=partId==='flame'?part:null;
  const layerId=poseId?'flame_'+poseId:part+'_base';
  layers.push({id:layerId,png:framed,x,y,opacity:1,
   visible:poseId===null||poseId==='flame_a'});
  ownership.set(layerId,{partId,poseId});
  const key=partId+'/'+(poseId??'base');
  bindings.set(key,[layerId]);
  if(part==='flame_a')bindings.set('flame/base',[layerId]);
  sourcePaintings.push(Object.freeze({
   partId,poseId,layerId,originalSha256:meta.sourceSha256,
   derivedLayerSha256:sha(framed),maskSha256:sha(mask),
   maskType:'DETERMINISTIC_ALPHA_DERIVED_NOT_NATIVE_ARTIST_MASK',
   sourceCanvas:[meta.width,meta.height],masterRect:{x,y,width:w,height:h}
  }));
 }
 const groups=[],parts=['body','flame','talisman_left','talisman_right','tassel'];
 for(const part of parts){
  groups.push({type:'group',id:'rig_'+part,visible:true,opacity:1,isolation:'isolate',
   children:sourcePaintings.filter(s=>s.partId===part).map(s=>({type:'layer',id:s.layerId}))});
 }
 const stackTree={type:'group',id:'root',children:groups};
 let ora;
 try{ora=writeOpenRaster({width:1024,height:1280,layers,stackTree})}
 catch(e){fail('OpenRaster failure: '+String(e?.message??e).slice(0,180))}
 return Object.freeze({
  ora,oraSha256:sha(ora),sourcePaintings:Object.freeze(sourcePaintings),
  maskPngs,ownership,bindings,paintGeneratedBy:'Adobe Firefly',
  sourceAuthentication:'PROVIDER_URL_UNATTESTED',providerOriginalAttested:false,
  origin:'R9D_NEW_AI_PAINTED_LAYERS_CANDIDATE',
  artisticReview:'UNSCORED',commercialRightsCleared:false,
  exportAllowed:false,
  placements:Object.freeze(Object.fromEntries(ORDER.map(id=>[id,Object.freeze({
   x:LAYOUT[id][0],y:LAYOUT[id][1],width:LAYOUT[id][2],height:LAYOUT[id][3]
  })])))
 });
}
