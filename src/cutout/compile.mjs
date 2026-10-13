import {validateDocument} from '../core/validate.mjs';
import {validateCutout} from './validate.mjs';
import {canonicalBytes,sha256Bytes} from '../evaluation/contracts.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
function deepFreeze(value){
 if(value&&typeof value==='object'){
  for(const child of Object.values(value))deepFreeze(child);
  Object.freeze(value);
 }
 return value;
}
export function compileCutout(document,manifest,{revision}={}){
 if(!Number.isSafeInteger(revision)||revision<0)throw new Error('invalid source revision');
 const valid=validateCutout(document,manifest);
 if(!valid.ok)throw new Error('invalid cutout: '+valid.errors.join('; '));
 const art=validateDocument(document);
 if(!art.ok)throw new Error('invalid ArtDocument: '+art.errors.join('; '));
 if(manifest.version!==2)throw new Error('compileCutout requires v2 manifest');
 const source=copy(document),cutout=copy(manifest);
 const compiled={
  sourceRevision:revision,
  sourceSha256:sha256Bytes(canonicalBytes(source)),
  manifestSha256:sha256Bytes(canonicalBytes(cutout)),
  source,
  manifest:cutout,
  parts:copy(cutout.parts),
  poseById:Object.fromEntries(cutout.poseVariants.map(p=>[p.id,copy(p)])),
  clipIds:cutout.animations.map(c=>c.id),
  canvas:copy(source.canvas)
 };
 return deepFreeze(compiled);
}
export function selectPartDocument(compiled,partId,poseId=null){
 if(!compiled||!Array.isArray(compiled.parts)||!compiled.source)throw new Error('invalid compiled cutout');
 const part=compiled.parts.find(p=>p.id===partId);
 if(!part)throw new Error('unknown part ID');
 let nodeIds=part.nodes;
 if(poseId!==null){
  const pose=compiled.poseById?.[poseId];
  if(!pose)throw new Error('unknown pose ID');
  if(pose.part!==partId)throw new Error('pose belongs to different part');
  nodeIds=pose.nodes;
 }
 const include=new Set(nodeIds);
 const nodes=compiled.source.nodes.filter(n=>include.has(n.id)).map(copy);
 if(nodes.length!==include.size)throw new Error('selected pose has missing node');
 const document={version:1,canvas:copy(compiled.source.canvas),nodes};
 const validation=validateDocument(document);
 if(!validation.ok)throw new Error('invalid selected pose: '+validation.errors.join('; '));
 return document;
}
