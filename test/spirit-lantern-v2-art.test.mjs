import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileCutout} from '../src/cutout/compile.mjs';
import {validateCutout} from '../src/cutout/validate.mjs';
import {auditLoop,sampleAnimation} from '../src/cutout/animation.mjs';
import {renderCutoutPreview} from '../src/cutout/preview.mjs';
import {loadStyleProfile} from '../src/style/profile.mjs';
import {inspectStyle} from '../src/style/inspect.mjs';
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const cutout=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
test('original Lantern v2 owns all explicit nodes and obeys approved style budget',async()=>{
 const result=validateCutout(source,cutout);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.warnings,[]);
 assert.equal(cutout.parts.length,5);
 assert.equal(cutout.poseVariants.length,4);
 const style=await loadStyleProfile('dark-cultivation-v1');
 const report=inspectStyle(source,style);
 assert.equal(report.ok,true,JSON.stringify(report));
});
test('authored flame, paper and tassel motions have verified 2-cycle continuity',()=>{
 const compiled=compileCutout(source,cutout,{revision:1});
 const qa=auditLoop(compiled,'idle');
 assert.equal(qa.ok,true,JSON.stringify(qa.errors));
 assert.ok(qa.metrics.samples>=120);
 assert.equal(cutout.frameSequence.fps,8);
 assert.equal(cutout.frameSequence.frames.length,16);
 const left=cutout.animations[0].tracks.find(x=>x.part==='talisman_left');
 const right=cutout.animations[0].tracks.find(x=>x.part==='talisman_right');
 const tassel=cutout.animations[0].tracks.find(x=>x.part==='tassel');
 assert.notDeepEqual(left.keys.map(x=>x.value),right.keys.map(x=>x.value));
 assert.notDeepEqual(tassel.keys.map(x=>x.time),left.keys.map(x=>x.time));
 const peak=sampleAnimation(compiled,'idle',0.75);
 assert.ok(peak.lightEnergy>0.6&&peak.lightEnergy<1.4);
});
test('four flame poses have genuinely different rendered PNG and time-selected metadata',async()=>{
 const compiled=compileCutout(source,cutout,{revision:1});
 const pngs=[];
 for(const timeSeconds of [0,.125,.25,.375]){
  const v=await renderCutoutPreview({compiled,clipId:'idle',timeSeconds});
  assert.deepEqual([...v.png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  pngs.push(v.frame.parts.flame.poseId);
 }
 assert.equal(new Set(pngs).size,4);
 const ids=source.nodes.map(n=>n.id);
 assert.equal(new Set(ids).size,ids.length);
});
