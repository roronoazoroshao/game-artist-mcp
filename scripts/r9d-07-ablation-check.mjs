import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {auditR9d07DenseTemporalFrames} from '../src/ai-art/r9d-07-temporal-qa.mjs';

const root=resolve('examples/spirit-lantern/generated');
const expected=[
 ['R9D06_BASELINE','r9d-06-baseline-godot'],
 ['R9D07_POLISHED','r9d-godot'],
 ['R9D07_FADE_ONLY','r9d-07-ablation-fade-godot'],
 ['R9D07_LIGHT_ONLY','r9d-07-ablation-light-godot'],
 ['R9D07_SOFT_60HZ','r9d-07-ablation-soft-godot'],
 ['R9D07_SMOOTH_FULL_55MS','r9d-07-ablation-full-godot']
];
const ORA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const readSet=async dir=>{
 const frames=new Map();
 for(let tick=0;tick<240;tick++)for(const size of (tick%2===0?[64,128]:[64])){
  const name='tick-'+String(tick).padStart(4,'0')+'-'+size+'.png';
  frames.set(name,await readFile(join(root,dir,'temporal',name)));
 }
 return frames;
};
const manifests=[];
for(const [variant,dir] of expected){
 const data=JSON.parse(await readFile(join(root,dir,'r9d-evidence.json'),'utf8'));
 if(data.presentationVariant!==variant||data.sourceOriSha256!==ORA||
    data.exportAllowed!==false||data.commercialRightsCleared!==false||
    data.artisticReview!=='UNSCORED')
  throw Error('R9D07_ABLATION_PROVENANCE_RIGHTS_REJECTED '+variant);
 manifests.push(data);
}
const sourceHashes=JSON.stringify(manifests[0].sourcePngSha256s);
if(!Object.keys(manifests[0].sourcePngSha256s).length||
   manifests.some(m=>JSON.stringify(m.sourcePngSha256s)!==sourceHashes))
 throw Error('R9D07_ABLATION_ORIGINAL_EIGHT_PNG_SHA_DRIFT');
const baseline=await readSet(expected[0][1]);
const outcomes={};
for(const [variant,dir] of expected.slice(1)){
 const candidate=await readSet(dir);
 const r=auditR9d07DenseTemporalFrames({
  baselineFrames:baseline,candidateFrames:candidate,
  metadata:{sourceOraSha256:ORA,sampleRateHz:120,durationSeconds:2,
   cropRect:[106,75,300,300],sizes:[64,128],
   engineVersion:process.env.GODOT_VERSION??'4.7.2-stable'}
 });
 const baseline64=r.variants.baseline;
 const candidate64=r.variants.candidate;
 const peaks=candidate64.adjacent64.map((pixels,i)=>({timeMs:Math.round((i+1)*1000/120),pixels}))
  .sort((a,b)=>b.pixels-a.pixels).slice(0,12);
 outcomes[variant]={
  baselineP95Jump64:baseline64.p95Jump64,
  candidateP95Jump64:candidate64.p95Jump64,
  baselineMaxJump64:baseline64.maxJump64,
  candidateMaxJump64:candidate64.maxJump64,
  baselineP95Jump128at60Hz:baseline64.p95Jump128,
  candidateP95Jump128at60Hz:candidate64.p95Jump128,
  candidateLoopSeam64:candidate64.loopSeamChangedPixels64,
  topJumpTimes:peaks,
  artisticReview:'UNSCORED'
 };
}
const report={
 evidence:'REAL_GODOT_XVFB_FRAMEBUFFERS_DETERMINISTIC_SEEK',
 physicalDisplayFramePacingVerified:false,
 sourceOraSha256:ORA,sourcePngSha256s:manifests[0].sourcePngSha256s,
 comparison:'R9D06_BASELINE_VS_ABLATIONS_SAME_GODOT_CAMERA_SOURCE',
 originalArtEdited:false,artisticReview:'UNSCORED',
 commercialRightsCleared:false,exportAllowed:false,
 results:outcomes
};
await writeFile(join(root,'r9d-godot','r9d-07-ablation-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log('R9D07_REAL_GODOT_ABLATION_FRAME_AUDIT_COMPLETE');
console.log(JSON.stringify(Object.fromEntries(Object.entries(outcomes).map(([name,r])=>
 [name,{p95Jump64:r.candidateP95Jump64,maxJump64:r.candidateMaxJump64,
  p95Jump128at60Hz:r.candidateP95Jump128at60Hz,peaks:r.topJumpTimes.slice(0,3)}]))));
