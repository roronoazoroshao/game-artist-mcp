import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {assertR9d07TemporalStability} from '../src/ai-art/r9d-07-temporal-qa.mjs';
const root=new URL('../examples/spirit-lantern/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('r9d/parts/sources/source-custody-001.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('v2/source.json',root),'utf8'));
const rig=JSON.parse(await readFile(new URL('v2/cutout.json',root),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
const pngs=new Map();
for(const item of custody.sources)pngs.set(item.partId,await readFile(new URL('r9d/parts/sources/'+item.partId+'.png',root)));
test('R9d-07 selected presentation retains wide smoothstep easing, provenance and blocked rights',()=>{
 const p=buildR9dCandidateGodotProject({sourcePngs:pngs,custody,compiled});
 const polish=JSON.parse(p.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
 assert.equal(polish.ghostEasing,'SMOOTHSTEP_FULL_55MS');
 assert.equal(polish.overlapConstrainedMs,55);
 assert.equal(polish.underlightTrack.alpha[0],polish.underlightTrack.alpha.at(-1));
 assert.equal(p.evidence.originalSha256,'f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361');
 assert.equal(p.evidence.exportAllowed,false);
});
test('R9d-07 measured 64px temporal guard rejects original popping regression',()=>{
 const base={p95Jump64:10,maxJump64:14};
 assert.doesNotThrow(()=>assertR9d07TemporalStability({baseline:base,candidate:{p95Jump64:16,maxJump64:20}}));
 assert.throws(()=>assertR9d07TemporalStability({baseline:base,candidate:{p95Jump64:30,maxJump64:43}}),/R9D07_TEMPORAL_REJECTED/);
 assert.throws(()=>assertR9d07TemporalStability({baseline:base,candidate:{p95Jump64:NaN,maxJump64:0}}),/R9D07_TEMPORAL_REJECTED/);
});
