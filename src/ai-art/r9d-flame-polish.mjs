import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {readOpenRaster} from './openraster.mjs';
import {verifyAtlas} from '../cutout/atlas.mjs';

const {PNG}=pngjs;
const fail=why=>{throw Error('R9D_FLAME_POLISH_REJECTED: '+why)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const SOURCE_ORA_SHA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const POSES=Object.freeze(['flame_a','flame_b','flame_c','flame_d']);
const AUTHORED=Object.freeze([
 'flame_a','flame_b','flame_c','flame_d','flame_b','flame_c','flame_d','flame_a',
 'flame_c','flame_d','flame_a','flame_b','flame_d','flame_a','flame_b','flame_c'
]);
const median=values=>{
 const s=[...values].sort((a,b)=>a-b);
 return (s[1]+s[2])/2;
};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const validSha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

/**
 * R9d-only, source-bound technical color/alpha measurements and bounded
 * presentation corrections. This does NOT repaint, resample, certify artistic
 * merit, validate native Krita masks, or grant commercial use.
 */
export function planR9dFlamePresentation({master,atlas,rig,options={}}={}){
 const custody=options?.custody;
 if(!master||!Buffer.isBuffer(master.ora)||!validSha(master.oraSha256)||
    hash(master.ora)!==SOURCE_ORA_SHA||
    master.oraSha256!==SOURCE_ORA_SHA||
    master.artisticReview!=='UNSCORED'||master.exportAllowed!==false||
    master.commercialRightsCleared!==false||
    !Array.isArray(master.sourcePaintings)||master.sourcePaintings.length!==8||
    !custody||!Array.isArray(custody.sources)||custody.sources.length!==8||
    custody.sourceCount!==8||custody.rightsVerified!==false||
    custody.artisticReview!=='UNSCORED'||custody.exportAllowed!==false||
    custody.storeKind!=='GIT_TRACKED_SOURCE_PNG')
  fail('original source SHA, source custody or rights invalid');
 if(!atlas||verifyAtlas(atlas).ok!==true||atlas.regions.length!==9||
    !Array.isArray(rig?.parts)||rig.parts.length!==5||
    !Array.isArray(rig.poseVariants)||rig.poseVariants.length!==4||
    rig.poseVariants.map(x=>x.id).join('|')!==POSES.join('|')||
    rig.poseVariants.some(x=>x.part!=='flame')||
    rig.frameSequence?.part!=='flame'||rig.frameSequence?.fps!==8||
    rig.frameSequence.frames?.join('|')!==AUTHORED.join('|')||
    !Array.isArray(rig.animations)||!rig.animations.some(x=>x.id==='idle'&&x.length===2))
  fail('unknown rig, atlas or animation source');
 for(let i=0;i<8;i++){
  const painting=master.sourcePaintings[i],source=custody.sources[i];
  if(!painting||!source||!validSha(source.sha256)||
     painting.originalSha256!==source.sha256||
     painting.partId!==(source.partId.startsWith('flame_')?'flame':source.partId)||
     painting.poseId!==(source.partId.startsWith('flame_')?source.partId:null)||
     !validSha(painting.derivedLayerSha256))
   fail('source paint SHA custody mismatch');
 }
 const doc=readOpenRaster(master.ora);
 if(doc.width!==1024||doc.height!==1280||doc.layers.length!==8)
  fail('wrong ORA master');
 const layers=new Map(doc.layers.map(x=>[x.id,x]));
 const poseSlots=[];
 for(const poseId of POSES){
  const painting=master.sourcePaintings.find(x=>x.poseId===poseId);
  const layer=layers.get('flame_'+poseId);
  const region=atlas.regions.find(x=>x.partId==='flame'&&x.poseId===poseId);
  if(!painting||!layer||!region||
     painting.derivedLayerSha256!==hash(layer.png)||
     !Array.isArray(region.localSpriteOffset)||region.localSpriteOffset.length!==2||
     region.localSpriteOffset.some(v=>!Number.isFinite(v)))
   fail('missing or altered flame painted layer/atlas mapping');
  let decoded;
  try{decoded=PNG.sync.read(layer.png,{checkCRC:true})}
  catch{fail('invalid painted PNG alpha or CRC');}
  if(layer.x<0||layer.y<0||layer.x+decoded.width>1024||layer.y+decoded.height>1280)
   fail('flame layer geometry outside source master');
  let weight=0,wx=0,wy=0,lit=0,count=0;
  for(let y=0;y<decoded.height;y++)for(let x=0;x<decoded.width;x++){
   const i=4*(y*decoded.width+x);
   const r=decoded.data[i],g=decoded.data[i+1],b=decoded.data[i+2],a=decoded.data[i+3];
   if(a<32||g<r+10||b<r+10)continue;
   const luminance=(0.2126*r+0.7152*g+0.0722*b);
   const w=(a/255)*luminance;
   weight+=w;wx+=(layer.x+x+.5)*w;wy+=(layer.y+y+.5)*w;
   lit+=w;count++;
  }
  if(count<20||weight<20)fail('no reliable cyan emissive source');
  poseSlots.push(Object.freeze({
   poseId,sourcePaintingSha256:painting.originalSha256,
   placedPaintingSha256:painting.derivedLayerSha256,
   centroidMaster:Object.freeze({x:wx/weight,y:wy/weight}),
   visibleCyanPixelCount:count,averageLuminance:lit/count,
   localSpriteOffset:Object.freeze([...region.localSpriteOffset]),
   textureRect:Object.freeze({...region.textureRect})
  }));
 }
 const cx=median(poseSlots.map(x=>x.centroidMaster.x));
 const cy=median(poseSlots.map(x=>x.centroidMaster.y));
 const meanLum=median(poseSlots.map(x=>x.averageLuminance));
 const correctionByPose={};
 for(const p of poseSlots){
  const delta=[
   clamp((cx-p.centroidMaster.x)/4,-2,2),
   clamp((cy-p.centroidMaster.y)/4,-2,2)
  ];
  const intensity=clamp(meanLum/p.averageLuminance,0.90,1.10);
  if(delta.some(v=>!Number.isFinite(v))||!Number.isFinite(intensity))
   fail('unbounded pose correction');
  correctionByPose[p.poseId]=Object.freeze({
   offsetRuntime:Object.freeze(delta),
   intensity,
   correctedSpriteOffset:Object.freeze([
    p.localSpriteOffset[0]+delta[0],p.localSpriteOffset[1]+delta[1]
   ])
  });
 }
 return Object.freeze({
  poseSlots:Object.freeze(poseSlots),
  correctionByPose:Object.freeze(correctionByPose),
  underlightPng:null,
  provenance:Object.freeze({
   algorithm:'R9D06_REAL_ALPHA_CYAN_SOURCE_MEASURE_V1',
   sourceOraSha256:SOURCE_ORA_SHA,atlasSha256:atlas.atlasSha256,
   sourceCount:8,originalsUnchanged:true,
   authoredFrames:Object.freeze([...AUTHORED]),
   centroidTargetMaster:Object.freeze({x:cx,y:cy}),
   underlightStatus:'PENDING_TASK_2',
   providerOriginalAttested:false,commercialRightsCleared:false,
   artisticReview:'UNSCORED',exportAllowed:false
  }),
  artisticReview:'UNSCORED',exportAllowed:false
 });
}
