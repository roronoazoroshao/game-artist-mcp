import pngjs from 'pngjs';
import {inspectAiPng} from './png-intake.mjs';
const {PNG}=pngjs;
const fail=reason=>{throw Error('R9B_EDGE_REJECTED: '+reason)};
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const PARTS=new Set(['body','flame','talisman_left','talisman_right','tassel']);
function decode(bytes){
 const info=inspectAiPng(bytes);
 return {...info,data:PNG.sync.read(bytes,{checkCRC:true}).data};
}
const pix=(data,width,x,y)=>(y*width+x)*4;
/**
 * Static 8-bit RGBA edge analysis. An advisory RGB fringe is not proof of a
 * visible artifact, and this does not measure animated pivot/underlap seams.
 */
export function analyzeLayerEdges({width,height,layers,ownerMasks}={}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
 width<1||height<1||width>4096||height>4096||width*height>4194304||
 !Array.isArray(layers)||layers.length<1||layers.length>24||
 !(ownerMasks instanceof Map))fail('invalid bounded canvas/layers/owner masks');
 const ids=new Set(),owners=new Set();let total=0;
 const decoded=layers.map(layer=>{
  if(!layer||typeof layer!=='object'||Array.isArray(layer)||
  Object.keys(layer).some(k=>!['id','partId','png','x','y','visible'].includes(k))||
  !ID.test(layer.id??'')||ids.has(layer.id)||!PARTS.has(layer.partId)||
  typeof layer.visible!=='boolean'||!Number.isSafeInteger(layer.x)||
  !Number.isSafeInteger(layer.y)||layer.x<0||layer.y<0)fail('invalid layer identity/ownership');
  ids.add(layer.id);owners.add(layer.partId);
  const raster=decode(layer.png);
  if(layer.x+raster.width>width||layer.y+raster.height>height)
   fail('layer outside canvas');
  total+=raster.width*raster.height*4;
  if(total>64*1024*1024)fail('decoded pixel budget');
  return {...layer,...raster};
 });
 if(ownerMasks.size!==owners.size)fail('missing/surplus owner masks');
 const masks=new Map();
 for(const part of owners){
  const bytes=ownerMasks.get(part);
  if(!Buffer.isBuffer(bytes))fail('missing owner mask '+part);
  const mask=decode(bytes);
  if(mask.width!==width||mask.height!==height)fail('owner mask dimensions');
  total+=mask.width*mask.height*4;
  if(total>64*1024*1024)fail('aggregate decoded pixel budget');
  masks.set(part,mask.data);
 }
 for(const key of ownerMasks.keys())if(!owners.has(key))fail('unlisted owner mask');
 const findings=[];const metrics={
  layerCount:decoded.length,visibleAlphaPixels:0,
  ownerMaskEscapes:0,transparentFringePixels:0,canvasTouchPixels:0
 };
 for(const layer of decoded){
  const mask=masks.get(layer.partId);
  let escaped=0,fringed=0,atBorder=0;
  for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){
   const i=pix(layer.data,layer.width,x,y),alpha=layer.data[i+3];
   const xx=layer.x+x,yy=layer.y+y;
   if(alpha>0){
    if(mask[pix(mask,width,xx,yy)+3]===0)escaped++;
    if(alpha>16&&(xx===0||yy===0||xx===width-1||yy===height-1))atBorder++;
    if(layer.visible)metrics.visibleAlphaPixels++;
   }else{
    if(!(layer.data[i]||layer.data[i+1]||layer.data[i+2]))continue;
    let neighbor=false,contrast=false;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
     const nx=x+dx,ny=y+dy;
     if(nx<0||ny<0||nx>=layer.width||ny>=layer.height)continue;
     const j=pix(layer.data,layer.width,nx,ny);
     if(layer.data[j+3]===0)continue;
     neighbor=true;
     if(Math.max(...[0,1,2].map(k=>Math.abs(layer.data[i+k]-layer.data[j+k])))>=80)
      contrast=true;
    }
    if(neighbor&&contrast)fringed++;
   }
  }
  metrics.ownerMaskEscapes+=escaped;
  metrics.transparentFringePixels+=fringed;
  metrics.canvasTouchPixels+=atBorder;
  if(escaped)findings.push(Object.freeze({layerId:layer.id,severity:'INVALID',
   code:'OWNER_MASK_ESCAPE',pixels:escaped}));
  if(fringed)findings.push(Object.freeze({layerId:layer.id,severity:'WARN',
   code:'RGB_IN_TRANSPARENT_EDGE',pixels:fringed}));
  if(atBorder)findings.push(Object.freeze({layerId:layer.id,severity:'WARN',
   code:'CANVAS_EDGE_TOUCH',pixels:atBorder}));
 }
 return Object.freeze({status:metrics.ownerMaskEscapes?'INVALID':
  metrics.transparentFringePixels||metrics.canvasTouchPixels?'WARN':'PASS',
  findings:Object.freeze(findings),metrics:Object.freeze(metrics),
  artisticReview:'UNSCORED',dynamicSeamVerified:false});
}
