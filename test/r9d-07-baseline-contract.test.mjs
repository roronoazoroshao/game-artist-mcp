import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';

const base=new URL('../examples/spirit-lantern/',import.meta.url);
const sourceRoot=new URL('r9d/parts/sources/',base);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',sourceRoot),'utf8'));
const rawSource=JSON.parse(await readFile(new URL('v2/source.json',base),'utf8'));
const rig=JSON.parse(await readFile(new URL('v2/cutout.json',base),'utf8'));
const compiled=compileCutout(rawSource,rig,{revision:1});
const sourcePngs=new Map();
for(const row of custody.sources)sourcePngs.set(row.partId,await readFile(new URL(row.partId+'.png',sourceRoot)));

test('R9d-07 comparison recreates immutable R9d-06 hybrid rather than R9d-05 or polished R9d-07',()=>{
 const baseline=buildR9dCandidateGodotProject({sourcePngs,custody,compiled,hybridFlame:true,r9d06Baseline:true});
 const polished=buildR9dCandidateGodotProject({sourcePngs,custody,compiled,hybridFlame:true});
 const path='assets/spirit_lantern/spirit_lantern.tscn';
 const before=String(baseline.files.get(path)),after=String(polished.files.get(path));
 const polish=JSON.parse(baseline.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
 assert.equal(baseline.master.oraSha256,polished.master.oraSha256);
 assert.equal(baseline.atlas.atlasSha256,polished.atlas.atlasSha256);
 assert.equal(polish.method,'R9D06_HYBRID_SOURCE_PRESERVING_TWO_SPRITE_FADE');
 assert.equal((before.match(/tracks\\/\\d+\\/type = "value"/g)||[]).length,16);
 assert.equal((after.match(/tracks\\/\\d+\\/type = "value"/g)||[]).length,17);
 assert.doesNotMatch(before,/body\\/CavityUnderlight:modulate/);
 assert.match(after,/body\\/CavityUnderlight:modulate/);
 assert.match(before,/body\\/flame\\/SpriteBlend2D:modulate/);
 assert.match(before,/z_index = 6/);
 assert.equal(baseline.evidence.exportAllowed,false);
 assert.equal(polished.evidence.exportAllowed,false);
});

test('R9d-06 source cannot be silently chosen as a non-hybrid or unrecognized mode',()=>{
 assert.throws(()=>buildR9dCandidateGodotProject({
  sourcePngs,custody,compiled,hybridFlame:false,r9d06Baseline:true
 }),/R9D_GODOT_REJECTED/);
 assert.throws(()=>buildR9dCandidateGodotProject({
  sourcePngs,custody,compiled,hybridFlame:true,r9d06Baseline:'yes'
 }),/R9D_GODOT_REJECTED/);
});

test('R9d-07 primary CI comparison and dense temporal QA must both use R9d-06 baseline',async()=>{
 const paths=['../.github/workflows/ci.yml','../scripts/r9d-06-compare.mjs',
  '../scripts/r9d-07-temporal-check.mjs','../scripts/r9d-real-godot-demo.mjs'];
 for(const path of paths){
  const content=await readFile(new URL(path,import.meta.url),'utf8');
  assert.match(content,/R9D06_BASELINE/,path);
 }
 const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert.match(workflow,/R9D_RENDER_VARIANT=R9D06_BASELINE/);
});
