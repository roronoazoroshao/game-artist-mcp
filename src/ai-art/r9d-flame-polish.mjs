import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {readOpenRaster} from './openraster.mjs';
import {deriveR9dFrontCageRail} from './r9d-depth-occlusion.mjs';
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

const CAVITY=Object.freeze({centerX:515,centerY:645,radiusX:99,radiusY:177,
 minX:416,maxX:614,minY:468,maxY:822,version:'AUTHORED_PAINTED_FIRE_CAVITY_V1'});
/**
 * This faint technical lighting buffer is derived from the actual painted
 * flame masks. It neither edits Firefly source pixels nor pretends to be an
 * artist-authored layer or Krita-native mask.
 */
function deriveUnderlight({doc,master,paintings}){
 const rail=deriveR9dFrontCageRail({ora:master.ora,expectedOraSha256:master.oraSha256});
 const front=PNG.sync.read(rail.runtimePng,{checkCRC:true});
 const poses=paintings.map(p=>{
  const layer=doc.layers.find(l=>l.id==='flame_'+p.poseId);
  if(!layer)fail('missing canonical underlight pose input');
  return {x:layer.x,y:layer.y,img:PNG.sync.read(layer.png,{checkCRC:true})};
 });
 const image=new PNG({width:256,height:320,colorType:6});
 let visibleGlowPixels=0,railOverlapPixels=0,maxAlpha=0;
 const sampled=(pose,mx,my)=>{
  const px=Math.floor(mx-pose.x),py=Math.floor(my-pose.y);
  if(px<0||py<0||px>=pose.img.width||py>=pose.img.height)return 0;
  return pose.img.data[4*(py*pose.img.width+px)+3];
 };
 for(let y=0;y<320;y++)for(let x=0;x<256;x++){
  const mx=4*x+2,my=4*y+2,q=4*(y*256+x);
  if(mx<CAVITY.minX||mx>CAVITY.maxX||my<CAVITY.minY||my>CAVITY.maxY)continue;
  const nx=(mx-CAVITY.centerX)/CAVITY.radiusX,
   ny=(my-CAVITY.centerY)/CAVITY.radiusY;
  const radial=nx*nx+ny*ny;
  if(radial>=1)continue;
  // Subtract even weak painted bronze-rail coverage; this overlay is behind
  // the rail in Godot and may not tint any actual foreground metal pixels.
  if(front.data[q+3]>0)continue;
  let sourceAlpha=0;
  for(const pose of poses){
   sourceAlpha=Math.max(sourceAlpha,
    sampled(pose,mx,my),sampled(pose,mx-8,my),sampled(pose,mx+8,my),
    sampled(pose,mx,my-8),sampled(pose,mx,my+8));
  }
  if(sourceAlpha<=5)continue;
  const falloff=Math.sqrt(1-radial);
  const alpha=Math.min(46,Math.round(46*(sourceAlpha/255)*falloff));
  if(alpha<=0)continue;
  image.data[q]=36;image.data[q+1]=214;image.data[q+2]=218;
  image.data[q+3]=alpha;
  maxAlpha=Math.max(maxAlpha,alpha);
  visibleGlowPixels++;
 }
 for(let i=3;i<front.data.length;i+=4){
  if(front.data[i]>=96&&image.data[i]>0)railOverlapPixels++;
 }
 if(visibleGlowPixels<100||railOverlapPixels!==0||maxAlpha>46)
  fail('untrusted underlight cavity/source overlap');
 const png=PNG.sync.write(image);
 return Object.freeze({
  png,
  provenance:Object.freeze({
   type:'R9D06_DERIVED_CAVITY_UNDERLIGHT_NOT_ORIGINAL_ART',
   cavity:CAVITY,
   sourceOraSha256:master.oraSha256,
   originalBodyLayerSha256:rail.sourceBodySha256,
   originalRailSha256:rail.overlaySha256,
   sourceFlameLayerSha256s:paintings.map(p=>p.derivedLayerSha256),
   sha256:hash(png),maxAlpha,visibleGlowPixels,railOverlapPixels,
   nativeKritaMask:false,sourceIsModelPaint:false,
   artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false
  })
 });
}


/**
 * R9d-only, source-bound technical color/alpha measurements and bounded
 * presentation corrections. This does NOT repaint, resample, certify artistic
 * merit, validate native Krita masks, or grant commercial use.
 */
export function planR9dFlamePresentation({master,atlas,rig,options={}}={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(k=>k!=='custody'))
  fail('unexpected cavity mask or lighting controls');
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
 const paintInputs=master.sourcePaintings.filter(p=>p.partId==='flame');
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
 const underlight=deriveUnderlight({doc,master,paintings:paintInputs});
 return Object.freeze({
  poseSlots:Object.freeze(poseSlots),
  correctionByPose:Object.freeze(correctionByPose),
  underlightPng:underlight.png,
  provenance:Object.freeze({
   algorithm:'R9D06_REAL_ALPHA_CYAN_SOURCE_MEASURE_V1',
   sourceOraSha256:SOURCE_ORA_SHA,atlasSha256:atlas.atlasSha256,
   sourceCount:8,originalsUnchanged:true,
   authoredFrames:Object.freeze([...AUTHORED]),
   centroidTargetMaster:Object.freeze({x:cx,y:cy}),
   underlight:underlight.provenance,
   providerOriginalAttested:false,commercialRightsCleared:false,
   artisticReview:'UNSCORED',exportAllowed:false
  }),
  artisticReview:'UNSCORED',exportAllowed:false
 });
}
