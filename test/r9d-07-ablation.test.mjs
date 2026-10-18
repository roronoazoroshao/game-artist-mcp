import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCutout} from '../src/cutout/compile.mjs';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {sampleR9dFlameMix} from '../src/export/r9d-flame-crossfade.mjs';

const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
const pngs=new Map();
for(const item of custody.sources)pngs.set(item.partId,await readFile(new URL(item.partId+'.png',root)));
const build=ablation=>buildR9dCandidateGodotProject({sourcePngs:pngs,custody,compiled,ablation});
const scene=project=>String(project.files.get('assets/spirit_lantern/spirit_lantern.tscn'));
const meta=project=>JSON.parse(project.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
const SHA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';

test('R9d-07 P1 isolated ablations split crossfade from underlight without touching source or rights',()=>{
 const fade=build('FADE_ONLY'),light=build('LIGHT_ONLY'),soft=build('SOFT_60HZ'),full=build('SMOOTH_FULL_55MS');
 for(const p of [fade,light,soft,full]){
  assert.equal(p.master.oraSha256,SHA);
  assert.equal(p.atlas.regions.length,9);
  assert.equal(p.evidence.exportAllowed,false);
  assert.equal((scene(p).match(/\[node name="SpiritLight"/g)||[]).length,1);
  assert.match(scene(p),/z_index = 6/);
  assert.equal(meta(p).artisticReview,'UNSCORED');
  assert.equal(meta(p).commercialRightsCleared,false);
 }
 assert.equal(meta(fade).ablation,'FADE_ONLY');
 assert.equal(meta(light).ablation,'LIGHT_ONLY');
 assert.equal(meta(soft).ablation,'SOFT_60HZ');
 assert.equal(meta(full).ablation,'SMOOTH_FULL_55MS');
 assert.equal(meta(full).ghostEasing,'SMOOTHSTEP_FULL_55MS');
 assert.equal(meta(full).overlapConstrainedMs,55);
 assert.equal((scene(fade).match(/NodePath\("body\/CavityUnderlight:modulate"\)/g)||[]).length,0);
 assert.equal((scene(light).match(/NodePath\("body\/CavityUnderlight:modulate"\)/g)||[]).length,1);
 assert.equal((scene(soft).match(/NodePath\("body\/CavityUnderlight:modulate"\)/g)||[]).length,1);
 assert.equal(meta(light).ghostEasing,'R9D06_LINEAR_55MS');
 assert.ok(meta(soft).overlapConstrainedMs>=28,'enough time for 60Hz intermediate frames');
 assert.equal((scene(full).match(/NodePath\("body\/CavityUnderlight:modulate"\)/g)||[]).length,1);
 assert.equal(meta(fade).underlightTrack,null);
 assert.ok(meta(light).underlightTrack.times.length>12);
 assert.throws(()=>build('ARBITRARY'),/R9D_GODOT_REJECTED/);
});
test('R9d-07 softer transition is complementary, finite and consistent at 60Hz on C to A',()=>{
 const sequence=compiled.manifest.frameSequence.frames;
 const soft=t=>sampleR9dFlameMix({sequence,timeSeconds:t,fadeProfile:'SOFT_60HZ'});
 const normal=t=>sampleR9dFlameMix({sequence,timeSeconds:t});
 for(const t of [0,0.07,.083333,.091667,.100,.108333,.116667,.124999,1.945,1.958333,1.975,1.991667,1.999,2]){
  const mix=soft(t);
  assert.ok(mix.primary.alpha>=0&&mix.primary.alpha<=1);
  assert.ok(mix.secondary.alpha>=0&&mix.secondary.alpha<=1);
  assert.ok(Math.abs(mix.primary.alpha+mix.secondary.alpha-1)<1e-6);
 }
 assert.ok(soft(.091667).secondary.alpha>normal(.091667).secondary.alpha);
 assert.ok(soft(.108333).secondary.alpha<normal(.108333).secondary.alpha);
 assert.equal(soft(0).primary.pose,'flame_a');
 assert.equal(soft(2).primary.pose,'flame_a');
 assert.equal(soft(2).primary.alpha,1);
 const full=t=>sampleR9dFlameMix({sequence,timeSeconds:t,fadeProfile:'SMOOTH_FULL_55MS'});
 assert.ok(full(.090).secondary.alpha>0&&full(.090).secondary.alpha<.5);
 assert.ok(full(.110).secondary.alpha>.5&&full(.110).secondary.alpha<1);
 assert.equal(full(2).primary.alpha,1);
 assert.throws(()=>sampleR9dFlameMix({sequence,timeSeconds:.1,fadeProfile:'UNTRUSTED'}),/R9D_CROSSFADE_REJECTED/);
});
