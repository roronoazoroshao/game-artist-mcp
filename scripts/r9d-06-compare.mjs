import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {auditR9d06TransitionComparison} from '../src/ai-art/r9d-motion-qa.mjs';

const base=resolve(process.argv[2]??'examples/spirit-lantern/generated/r9d-05-baseline-godot');
const candidate=resolve(process.argv[3]??'examples/spirit-lantern/generated/r9d-godot');
const manifest=async dir=>JSON.parse(await readFile(join(dir,'r9d-evidence.json'),'utf8'));
const [before,after]=await Promise.all([manifest(base),manifest(candidate)]);
const SRC='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
if(before.presentationVariant!=='R9D05_BASELINE'||after.presentationVariant!=='R9D07_POLISHED'||
 before.sourceOriSha256!==SRC||after.sourceOriSha256!==SRC||
 JSON.stringify(before.sourcePngSha256s)!==JSON.stringify(after.sourcePngSha256s)||
 before.exportAllowed!==false||after.exportAllowed!==false||
 before.artisticReview!=='UNSCORED'||after.artisticReview!=='UNSCORED')
 throw Error('R9D07_SOURCE_OR_VARIANT_REJECTED');
const TIMES=[0,1,69,70,95,124,125,180,375,750,1250,1875,1945,1999];
const sizes=[512,128,64];
const get=async dir=>{
 const out=new Map();
 for(const t of TIMES)for(const size of sizes){
  const name='r9d-t-'+String(t).padStart(4,'0')+'-'+size+'.png';
  out.set(name,await readFile(join(dir,name)));
 }
 return out;
};
const report=auditR9d06TransitionComparison({
 baselineFrames:await get(base),
 candidateFrames:await get(candidate),
 metadata:{
  sourceSha256:SRC,engineVersion:process.env.GODOT_VERSION??'4.7.2-stable',
  camera:[512,512],crop:[106,75,300,300],
  framesByScale:{512:'FULL_SCENE',128:'300x300_FIXED_ITEM_CROP',64:'300x300_FIXED_ITEM_CROP'},
  timesMs:TIMES
 }
});
const releaseBlocked={...report,technicalOnly:true,
 sourceOriginalEightSha256:before.sourcePngSha256s,
 baselineVariant:before.presentationVariant,
 candidateVariant:after.presentationVariant,
 artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false,
 gameplayAnimationSmoothnessVerified:false};
await writeFile(join(candidate,'r9d-07-visual-qa.json'),
 JSON.stringify(releaseBlocked,null,2)+'\n');
console.log('R9D07_REAL_GODOT_THREE_SCALE_COMPARE_METRICS_WRITTEN');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,
 framesPerVariant:report.framesPerVariant,loopSeamComparison:report.loopSeamComparison,
 artisticReview:report.artisticReview,exportAllowed:report.exportAllowed}));
