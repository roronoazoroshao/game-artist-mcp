import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {auditR9d07DenseTemporalFrames,assertR9d07TemporalStability} from '../src/ai-art/r9d-07-temporal-qa.mjs';
const base=resolve(process.argv[2]??'examples/spirit-lantern/generated/r9d-06-baseline-godot');
const polished=resolve(process.argv[3]??'examples/spirit-lantern/generated/r9d-godot');
const a=JSON.parse(await readFile(join(base,'r9d-evidence.json'),'utf8'));
const b=JSON.parse(await readFile(join(polished,'r9d-evidence.json'),'utf8'));
const SHA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
if(a.presentationVariant!=='R9D06_BASELINE'||b.presentationVariant!=='R9D07_POLISHED'||
 a.sourceOriSha256!==SHA||b.sourceOriSha256!==SHA||
 a.artisticReview!=='UNSCORED'||b.artisticReview!=='UNSCORED'||
 a.exportAllowed!==false||b.exportAllowed!==false||
 JSON.stringify(a.sourcePngSha256s)!==JSON.stringify(b.sourcePngSha256s))
 throw Error('R9D07_DENSE_CAPTURE_SOURCE_OR_RIGHTS_REJECTED');
const readSet=async dir=>{
 const frames=new Map();
 for(let t=0;t<240;t++)for(const size of (t%2===0?[64,128]:[64])){
  const name='tick-'+String(t).padStart(4,'0')+'-'+size+'.png';
  frames.set(name,await readFile(join(dir,'temporal',name)));
 }
 return frames;
};
const report=auditR9d07DenseTemporalFrames({
 baselineFrames:await readSet(base),candidateFrames:await readSet(polished),
 metadata:{
  sourceOraSha256:SHA,sampleRateHz:120,durationSeconds:2,
  cropRect:[106,75,300,300],sizes:[64,128],
  engineVersion:process.env.GODOT_VERSION??'4.7.2-stable'
 }
});
const temporalGate=assertR9d07TemporalStability({baseline:report.variants.baseline,candidate:report.variants.candidate});
await writeFile(join(polished,'r9d-07-temporal-dense-review.json'),
 JSON.stringify({...report,temporalGate,artifactSource:'REAL_GODOT_XVFB_FRAMEBUFFERS',
  visualArtAcceptance:'PENDING_HUMAN_60HZ_AND_120HZ_MOVEMENT_REVIEW',
  monitorFramePacing:'NOT_MEASURED',
  imageSource:'ORIGINAL_FIRE_FLY_8_PNG_SHA_FROZEN',
  commercialRightsCleared:false,exportAllowed:false},null,2)+'\n');
console.log('R9D07_DENSE_GODOT_TEMPORAL_FRAME_AUDIT_COMPLETE');
console.log(JSON.stringify({
 baselineP95Jump64:report.variants.baseline.p95Jump64,
 candidateP95Jump64:report.variants.candidate.p95Jump64,
 baselineMaxJump64:report.variants.baseline.maxJump64,
 candidateMaxJump64:report.variants.candidate.maxJump64,
 baselineLoopSeam:report.variants.baseline.loopSeamChangedPixels64,
 candidateLoopSeam:report.variants.candidate.loopSeamChangedPixels64,
 artisticReview:report.artisticReview
}));
