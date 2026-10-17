import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {readOpenRaster} from './openraster.mjs';
import {inspectAiPng} from './png-intake.mjs';
import {composeLayers} from './layer-composite.mjs';
import {cropAlphaPng} from '../cutout/raster.mjs';
const {PNG}=pngjs;
const fail=reason=>{throw Error('R9C_FRAME_REJECTED: '+reason)};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const asPart=entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)&&
 Object.keys(entry).sort().join('|')==='partId|poseId'&&
 ID.test(entry.partId)&&
 (entry.poseId===null||typeof entry.poseId==='string'&&ID.test(entry.poseId));

/**
 * Straight RGBA PNG -> straight RGBA PNG with premultiplied-color area
 * averaging. Transparent black samples cannot introduce dark halos.
 */
export function downsampleStraightAlpha(png,factor){
 const meta=inspectAiPng(png);
 if(!Number.isSafeInteger(factor)||factor<1||factor>4||
 meta.width%factor!==0||meta.height%factor!==0)fail('invalid integer alpha scale');
 const original=PNG.sync.read(png,{checkCRC:true});
 const w=meta.width/factor,h=meta.height/factor;
 const dest=new PNG({width:w,height:h,colorType:6});
 const count=factor*factor;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let alpha=0;const sums=[0,0,0];
  for(let oy=0;oy<factor;oy++)for(let ox=0;ox<factor;ox++){
   const p=((y*factor+oy)*meta.width+x*factor+ox)*4;
   const a=original.data[p+3];
   alpha+=a;
   for(let k=0;k<3;k++)sums[k]+=original.data[p+k]*a;
  }
  const at=(y*w+x)*4;
  if(alpha>0)for(let k=0;k<3;k++)
   dest.data[at+k]=Math.min(255,Math.round(sums[k]/alpha));
  dest.data[at+3]=Math.min(255,Math.round(alpha/count));
 }
 return PNG.sync.write(dest);
}

/**
 * An explicit, hashable bridge from ORIGINAL raster layer bytes to
 * the established atlas frame shape. Never call the SVG renderer here.
 * The source's rights remain blocked, and the vectors (if any) in the rig
 * compiler exist only to validate geometry/animation—not as painted pixels.
 */
export function renderRasterFrames({
 ora,compiled,bindings,ownership,runtimeCanvas={width:256,height:320}
}={}){
 if(!Buffer.isBuffer(ora)||!(bindings instanceof Map)||
 !(ownership instanceof Map)||runtimeCanvas?.width!==256||
 runtimeCanvas.height!==320||compiled?.manifest?.version!==2||
 !Array.isArray(compiled.parts)||!Number.isSafeInteger(compiled.sourceRevision)||
 typeof compiled.sourceSha256!=='string')
  fail('invalid manifest/source inputs or runtime resolution');
 const rig=compiled.manifest;
 if(rig.assetId!=='spirit_lantern'||rig.parts.length!==5||
 rig.poseVariants.length!==4||
 rig.poseVariants.some(p=>p.part!=='flame')||
 !Array.isArray(rig.frameSequence?.frames)||
 rig.frameSequence.frames.length<4)fail('unsupported first-slice rig');
 const doc=readOpenRaster(ora);
 const factor=doc.width/256;
 if(![1,4].includes(factor)||doc.height!==320*factor)
  fail('unsupported runtime/master ORA canvas');
 const ids=new Map(doc.layers.map(l=>[l.id,l]));
 if(ownership.size!==ids.size)fail('missing or surplus layer ownership records');
 for(const [id,owner] of ownership){
  if(!ids.has(id)||!asPart(owner)||
    !rig.parts.some(p=>p.id===owner.partId)||
    (owner.poseId!==null&&!(owner.partId==='flame'&&
     rig.poseVariants.some(p=>p.id===owner.poseId))))
   fail('invalid or unlisted source layer ownership');
 }
 const required=[
  ...rig.parts.map(p=>[p.id,null]),
  ...rig.poseVariants.map(p=>[p.part,p.id])
 ];
 if(bindings.size!==required.length)fail('missing/surplus frame bindings');
 const frameSeen=new Set(),used=new Set(),frames=[];
 for(const [partId,poseId] of required){
  const key=partId+'/'+(poseId??'base'),selected=bindings.get(key);
  if(frameSeen.has(key)||!Array.isArray(selected)||selected.length<1||
    selected.length>24||new Set(selected).size!==selected.length||
    selected.some(id=>typeof id!=='string'||!ids.has(id)))fail('missing/invalid frame layer bindings');
  frameSeen.add(key);
  const chosen=new Set(selected);
  for(const id of chosen){
   const owner=ownership.get(id);
   const baseFlameAlias=partId==='flame'&&poseId===null&&owner.partId==='flame'&&
    owner.poseId==='flame_a'&&bindings.get('flame/flame_a')?.includes(id);
   if(owner.partId!==partId||(owner.poseId!==poseId&&!baseFlameAlias))
    fail('cross-part or wrong-pose source binding');
   if(used.has(id)&&!baseFlameAlias&&!(partId==='flame'&&poseId==='flame_a'&&
      bindings.get('flame/base')?.includes(id)))fail('layer shared across foreign poses');
   used.add(id);
  }
  const subset=doc.layers.filter(l=>chosen.has(l.id)).map(l=>({
   id:l.id,png:l.png,x:l.x,y:l.y,opacity:l.opacity,visible:true
  }));
  const paint=composeLayers({width:doc.width,height:doc.height,layers:subset});
  const runtime=factor===1?paint:downsampleStraightAlpha(paint,factor);
  const crop=cropAlphaPng(runtime,{paddingPx:rig.rendering.paddingPx});
  const part=rig.parts.find(p=>p.id===partId);
  frames.push({partId,poseId,
   sourceRevision:compiled.sourceRevision,sourceSha256:doc.sha256,
   sourceSvgSha256:null,rawPng:runtime,crop,
   pivotSource:[...part.pivot]});
 }
 for(const key of bindings.keys())if(!frameSeen.has(key))fail('unexpected frame binding key');
 if(used.size!==doc.layers.length)fail('unbound source paint layers');
 return Object.freeze({
  origin:factor===1?'LEGACY_VECTOR_RASTER_TECHNICAL':'R9A_IMPORTED_UNATTESTED',
  frames,sourceSha256:doc.sha256,rigSourceSha256:compiled.sourceSha256,
  sourceRevision:compiled.sourceRevision,masterWidth:doc.width,
  masterHeight:doc.height,runtimeCanvas:{width:256,height:320},
  exportAllowed:false,artisticReview:'UNSCORED'
 });
}
