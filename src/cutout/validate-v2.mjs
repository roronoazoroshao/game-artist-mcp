import {validateDocument} from '../core/validate.mjs';

const ID=/^[a-z][a-z0-9_]{0,63}$/;
const HEX=/^#[0-9a-fA-F]{6}$/;
const PROPS=new Set(['rotation','position','scale','light_energy']);
const INTERP=new Set(['linear','smoothstep']);
const ROLES=new Set(['body','emission','secondary_motion','equipment','foreground','background']);
const safe=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const num=x=>typeof x==='number'&&Number.isFinite(x);
const vec=x=>Array.isArray(x)&&x.length===2&&x.every(num);
const keys=(o,allowed,required=allowed)=>safe(o)&&Object.keys(o).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(o,k));
const push=(errors,message)=>{errors.push(message);};
const result=(errors)=>({ok:errors.length===0,errors,warnings:[]});

export function validateCutoutV2(document,manifest){
 const errors=[];
 try{
  const dv=validateDocument(document);errors.push(...dv.errors.map(e=>'document: '+e));
  if(!safe(document?.canvas)||!Array.isArray(document?.nodes))return result([...errors,'invalid source ArtDocument']);
  if(!safe(manifest)||manifest.version!==2)return result([...errors,'cutout.version must be 2']);
  if(!keys(manifest,['version','assetId','parts','animations','rendering','poseVariants','frameSequence','light','collision'],
    ['version','assetId','parts','animations','rendering','poseVariants','frameSequence']))push(errors,'cutout unexpected or missing keys');
  if(typeof manifest.assetId!=='string'||!ID.test(manifest.assetId))push(errors,'invalid cutout.assetId');
  if(!Array.isArray(manifest.parts)||manifest.parts.length<1||manifest.parts.length>64)return result([...errors,'parts must contain 1..64 items']);
  const W=document.canvas.width,H=document.canvas.height;
  if(!num(W)||!num(H)||W<=0||H<=0||W>4096||H>4096)push(errors,'invalid canvas bounds');
  const nodeIds=new Set(),nodeOwners=new Map();
  for(const node of document.nodes){
   if(!safe(node)||typeof node.id!=='string'||!ID.test(node.id)){push(errors,'unsafe source node ID');continue;}
   if(nodeIds.has(node.id))push(errors,'duplicate source node '+node.id);
   nodeIds.add(node.id);
   // v2 does not allow free-form SVG transform grammar, external resources or shaders.
   if(node.transform!==undefined)push(errors,'v2 unsupported unsafe SVG transform');
   for(const prop of ['fill','stroke']){
    const paint=node[prop];
    if(paint!==undefined&&paint!=='none'&&(typeof paint!=='string'||!HEX.test(paint)))
     push(errors,'v2 unsafe '+prop+' paint on node '+node.id);
   }
  }
  const partIds=new Set(),byPart=new Map();
  for(const part of manifest.parts){
   if(!keys(part,['id','nodes','pivot','parent','zIndex','role'],['id','nodes','pivot','parent','zIndex','role'])){push(errors,'part unexpected or missing keys');continue;}
   if(typeof part.id!=='string'||!ID.test(part.id)||partIds.has(part.id))push(errors,'invalid/duplicate part ID');
   partIds.add(part.id);byPart.set(part.id,part);
   if(!Array.isArray(part.nodes)||part.nodes.length<1||part.nodes.length>64){push(errors,'part.nodes must contain 1..64 source IDs');continue;}
   const seen=new Set();
   for(const id of part.nodes){
    if(typeof id!=='string'||!nodeIds.has(id))push(errors,'part refers to missing source node');
    if(seen.has(id))push(errors,'duplicate node in part');
    seen.add(id);
    if(nodeOwners.has(id))push(errors,'duplicate base node ownership');
    nodeOwners.set(id,{partId:part.id,poseId:null});
   }
   if(!vec(part.pivot)||part.pivot[0]<0||part.pivot[1]<0||part.pivot[0]>W||part.pivot[1]>H)push(errors,'invalid/out-of-bounds part pivot');
   if(part.parent!==null&&typeof part.parent!=='string')push(errors,'part parent must be null or valid part ID');
   if(!Number.isInteger(part.zIndex)||Math.abs(part.zIndex)>512)push(errors,'invalid part zIndex');
   if(typeof part.role!=='string'||!ROLES.has(part.role))push(errors,'unsupported part role');
  }
  for(const part of manifest.parts){
   if(!safe(part)||!ID.test(String(part.id??'')))continue;
   if(part.parent!==null&&!partIds.has(part.parent))push(errors,'unknown part parent');
   const seen=new Set();let cur=part;
   while(cur?.parent){
    if(seen.has(cur.id)){push(errors,'part parent cycle');break;}
    seen.add(cur.id);cur=byPart.get(cur.parent);
    if(!cur)break;
   }
  }
  const rend=manifest.rendering;
  if(!keys(rend,['format','paddingPx','maxAtlasSize','scale']))push(errors,'invalid rendering keys');
  else if(rend.format!=='atlas_png'||!Number.isInteger(rend.paddingPx)||rend.paddingPx<2||rend.paddingPx>8||
   !Number.isInteger(rend.maxAtlasSize)||rend.maxAtlasSize<64||rend.maxAtlasSize>2048||rend.scale!==1)push(errors,'invalid atlas rendering budget');
  if(!Array.isArray(manifest.poseVariants)||manifest.poseVariants.length<1||manifest.poseVariants.length>16)push(errors,'poseVariants length must be 1..16');
  const poseIds=new Set(),posePart=new Map();
  for(const pose of Array.isArray(manifest.poseVariants)?manifest.poseVariants.slice(0,17):[]){
   if(!keys(pose,['id','part','nodes'])){push(errors,'invalid pose fields');continue;}
   if(typeof pose.id!=='string'||!ID.test(pose.id)||poseIds.has(pose.id))push(errors,'invalid/duplicate pose ID');
   poseIds.add(pose.id);posePart.set(pose.id,pose.part);
   if(!partIds.has(pose.part))push(errors,'pose belongs to unknown part');
   if(!Array.isArray(pose.nodes)||pose.nodes.length===0||pose.nodes.length>64){push(errors,'invalid pose nodes');continue;}
   const seen=new Set();
   for(const id of pose.nodes){
    if(typeof id!=='string'||!nodeIds.has(id))push(errors,'pose missing node');
    if(seen.has(id))push(errors,'duplicate node in pose');
    seen.add(id);
    if(nodeOwners.has(id))push(errors,'node owned by more than one pose or part');
    nodeOwners.set(id,{partId:pose.part,poseId:pose.id});
   }
  }
  for(const id of nodeIds)if(!nodeOwners.has(id))push(errors,'unowned visible source node: '+id);
  const seq=manifest.frameSequence;
  if(!keys(seq,['part','fps','frames','loop']))push(errors,'invalid frameSequence keys');
  else{
   if(!partIds.has(seq.part))push(errors,'frameSequence part unknown');
   if(!Number.isInteger(seq.fps)||seq.fps<1||seq.fps>24)push(errors,'frameSequence fps out of range');
   if(!Array.isArray(seq.frames)||seq.frames.length<1||seq.frames.length>16)push(errors,'frameSequence frame count invalid');
   else for(const id of seq.frames)if(!poseIds.has(id)||posePart.get(id)!==seq.part)push(errors,'frameSequence frame pose or part invalid: '+id);
   if(seq.loop!==true)push(errors,'frameSequence must loop');
  }
  if(!Array.isArray(manifest.animations)||manifest.animations.length<1||manifest.animations.length>32)push(errors,'animations must be 1..32 clips');
  const clips=new Set();
  for(const clip of Array.isArray(manifest.animations)?manifest.animations.slice(0,33):[]){
   if(!keys(clip,['id','length','loop','tracks'],['id','length','loop','tracks'])){push(errors,'invalid clip keys');continue;}
   if(typeof clip.id!=='string'||!ID.test(clip.id)||clips.has(clip.id))push(errors,'invalid/duplicate clip ID');
   clips.add(clip.id);
   if(!num(clip.length)||clip.length<=0||clip.length>60||clip.loop!==true)push(errors,'invalid clip length or looping');
   if(!Array.isArray(clip.tracks)||clip.tracks.length<1||clip.tracks.length>128){push(errors,'clip tracks out of bounds');continue;}
   const used=new Set();
   for(const track of clip.tracks){
    if(!keys(track,['part','property','keys','interpolation'],['part','property','keys'])){push(errors,'invalid track keys');continue;}
    if(!partIds.has(track.part)||!PROPS.has(track.property))push(errors,'unknown part or animation property');
    if(track.interpolation!==undefined&&!INTERP.has(track.interpolation))push(errors,'invalid interpolation');
    if(track.property==='light_energy'&&track.part!==manifest.light?.part)push(errors,'light energy track requires emission part');
    const key=track.part+':'+track.property;
    if(used.has(key))push(errors,'duplicate animation property track');
    used.add(key);
    if(!Array.isArray(track.keys)||track.keys.length<2||track.keys.length>64){push(errors,'invalid key count');continue;}
    let last=-Infinity;
    for(const k of track.keys){
     if(!keys(k,['time','value'])||!num(k.time)||k.time<0||k.time<=last||k.time>clip.length){push(errors,'invalid/duplicate key time');continue;}
     last=k.time;
     if(track.property==='rotation'&&!num(k.value))push(errors,'rotation requires scalar');
     if(track.property==='light_energy'&&(!num(k.value)||k.value<0||k.value>16))push(errors,'invalid light energy');
     if(['position','scale'].includes(track.property)&&!vec(k.value))push(errors,'transform must be Vec2');
     if(track.property==='scale'&&vec(k.value)&&k.value.some(v=>v<=0))push(errors,'scale must remain positive');
    }
    if(track.keys[0]?.time!==0||track.keys.at(-1)?.time!==clip.length)push(errors,'loop keys must span 0..duration');
   }
   if(safe(seq)&&Number.isInteger(seq.fps)&&Array.isArray(seq.frames)&&seq.frames.length&&num(clip.length)&&
     Math.abs((clip.length*seq.fps)/seq.frames.length-Math.round((clip.length*seq.fps)/seq.frames.length))>1e-8)push(errors,'frame sequence period must divide looping clip duration');
  }
  if(manifest.light!==undefined){
   const l=manifest.light;
   if(!keys(l,['part','position','color','energy','textureScale']))push(errors,'invalid light metadata');
   else if(!partIds.has(l.part)||!vec(l.position)||!HEX.test(l.color)||!num(l.energy)||l.energy<0||l.energy>16||
     !num(l.textureScale)||l.textureScale<=0||l.textureScale>16)push(errors,'invalid light fields');
  }
  if(manifest.collision!==undefined){
   const c=manifest.collision;
   if(!keys(c,['position','size']))push(errors,'invalid collision metadata');
   else if(!vec(c.position)||!vec(c.size)||c.size.some(v=>v<=0))push(errors,'invalid collision bounds');
  }
 }catch(error){errors.push('invalid v2 structure: '+String(error?.message??'unknown'))}
 return result(errors);
}
