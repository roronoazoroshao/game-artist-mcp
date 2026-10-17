import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {auditR9dMotionScreenshots} from '../src/ai-art/r9d-motion-qa.mjs';
const fail=why=>{throw Error('R9D_MOTION_PACKET_REJECTED: '+why)};
const base=resolve(process.argv[2]??'examples/spirit-lantern/generated/r9d-godot');
const evidence=JSON.parse(await readFile(join(base,'r9d-evidence.json'),'utf8'));
if(evidence.paintedByAI!==true||evidence.exportAllowed!==false||
 evidence.artisticReview!=='UNSCORED'||!/^[a-f0-9]{64}$/.test(evidence.sourceOriSha256??''))fail('unsafe artwork source claims');
const frames=new Map();
for(const ms of [0,125,375,750,1250,1875])for(const size of [512,128,64]){
 const name='r9d-t-'+String(ms).padStart(4,'0')+'-'+size+'.png';
 frames.set(name,await readFile(join(base,name)));
}
const result=auditR9dMotionScreenshots({
 frames,sourceSha256:evidence.sourceOriSha256
});
await writeFile(join(base,'r9d-motion-qa.json'),JSON.stringify({
 ...result,
 screenshotProvenance:'PINNED_GODOT_XVFB_REAL_RENDER',
 framingByScale:{'512':'FULL_SCENE','128':'300x300_FIXED_ITEM_CROP','64':'300x300_FIXED_ITEM_CROP'},
 cropRectAt512:{x:106,y:75,width:300,height:300},
 sourceType:'R9D_NEW_ADOBE_FIREFLY_PAINTED_PNG_COMPONENTS',
 productionSmoothnessVerified:false,
 artisticReview:'UNSCORED',exportAllowed:false
},null,2)+'\n');
console.log('R9D_REAL_GODOT_MOTION_FRAME_PACKET_TECHNICAL_PASS');
console.log(JSON.stringify({frames:result.frameCount,
 significantTransitions:result.significantTransitions,
 changedPixelPairs:result.changedPixelPairs,
 artisticReview:result.artisticReview,exportAllowed:result.exportAllowed}));
