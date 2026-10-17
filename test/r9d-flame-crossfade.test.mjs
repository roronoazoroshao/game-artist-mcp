import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {planR9dFlamePresentation} from '../src/ai-art/r9d-flame-polish.mjs';
import {transformR9dFlameScene,sampleR9dFlameMix} from '../src/export/r9d-flame-crossfade.mjs';
const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const rawSource=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(rawSource,rig,{revision:1});
async function fixture(){
 const original=new Map();
 for(const row of custody.sources)original.set(row.partId,await readFile(new URL(row.partId+'.png',root)));
 const project=buildR9dCandidateGodotProject({sourcePngs:original,custody,compiled});
 const presentation=planR9dFlamePresentation({master:project.master,atlas:project.atlas,rig:compiled.manifest,options:{custody}});
 return {project,presentation,scene:String(project.files.get('assets/spirit_lantern/spirit_lantern.tscn'))};
}
test('R9d-06 generated scene contains only two flame sprites and the authored sixteen-pose 55ms crossfade',async()=>{
 const {project,presentation,scene}=await fixture();
 const result=transformR9dFlameScene({scene,atlas:project.atlas,rig:compiled.manifest,presentation,durationSeconds:2});
 assert.equal((result.scene.match(/\[node name="SpriteBlend2D" type="Sprite2D" parent="body\/flame"\]/g)||[]).length,1);
 assert.match(result.scene,/body\/flame\/SpriteBlend2D:texture/);
 assert.match(result.scene,/body\/flame\/SpriteBlend2D:modulate/);
 assert.match(result.scene,/body\/flame\/Sprite2D:modulate/);
 assert.equal(result.trackEvidence.transitionMs,55);
 assert.equal(result.trackEvidence.phaseCount,16);
 assert.deepEqual(result.trackEvidence.authoredPoses,rig.frameSequence.frames);
 assert.equal(result.trackEvidence.wrap,'C_TO_A');
 assert.ok(result.scene.includes('FrontCageRail'));
 assert.ok(result.scene.includes('z_index = 6'));
 assert.equal(result.trackEvidence.exportAllowed,false);
});
test('R9d-06 alternating hidden sprite prepares exact next source pose with complementary alpha at wrap',()=>{
 const sequence=rig.frameSequence.frames;
 for(const t of [0,.07,.095,.124,.125,.195,.25,1.875,1.945,1.999,2.0]){
  const s=sampleR9dFlameMix({sequence,timeSeconds:t});
  assert.ok(s.primary.alpha>=0&&s.primary.alpha<=1);
  assert.ok(s.secondary.alpha>=0&&s.secondary.alpha<=1);
  assert.ok(Math.abs(s.primary.alpha+s.secondary.alpha-1)<1e-6);
  assert.ok(['flame_a','flame_b','flame_c','flame_d'].includes(s.primary.pose));
  assert.ok(['flame_a','flame_b','flame_c','flame_d'].includes(s.secondary.pose));
 }
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:0}).primary.pose,'flame_a');
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:.125}).secondary.pose,'flame_b');
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:.125}).primary.pose,'flame_c');
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:1.999}).primary.pose,'flame_a');
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:2}).primary.pose,'flame_a');
 assert.equal(sampleR9dFlameMix({sequence,timeSeconds:2}).primary.alpha,1);
});
test('R9d-06 must preserve unrelated motion, collision and SpiritLight animation tracks',async()=>{
 const {project,presentation,scene}=await fixture();
 const output=transformR9dFlameScene({scene,atlas:project.atlas,rig:compiled.manifest,presentation,durationSeconds:2});
 for(const p of ['body/talisman_left:rotation','body/talisman_right:rotation','body/tassel:rotation','body/flame/SpiritLight:energy'])
  assert.ok(output.scene.includes(p),'original motion track not discarded: '+p);
 assert.equal((output.scene.match(/\[node name="SpiritLight"/g)||[]).length,1);
 assert.equal((output.scene.match(/\[node name="FrontCageRail"/g)||[]).length,1);
 assert.equal(output.trackEvidence.sourceAtlasSha256,project.atlas.atlasSha256);
});
test('R9d-06 fails closed when Godot scene has unknown resource, missing old track or injected duplicate flame',async()=>{
 const {project,presentation,scene}=await fixture();
 const options={atlas:project.atlas,rig:compiled.manifest,presentation,durationSeconds:2};
 for(const bad of [
  scene.replace('id="Atlas_flame_flame_d"','id="Atlas_injected"'),
  scene.replace('body/flame/Sprite2D:texture','body/flame/Sprite2D:WRONG'),
  scene+'\n[node name="SpriteBlend2D" type="Sprite2D" parent="body/flame"]\n',
  scene.replace('z_index = 6','z_index = 0')
 ])assert.throws(()=>transformR9dFlameScene({...options,scene:bad}),/R9D_CROSSFADE_REJECTED/);
});
