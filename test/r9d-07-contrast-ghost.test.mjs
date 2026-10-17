import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {sampleR9dFlameMix} from '../src/export/r9d-flame-crossfade.mjs';
const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
const frames=compiled.manifest.frameSequence.frames;
const lightKeys=rig.animations[0].tracks.find(x=>x.property==='light_energy').keys;
async function project(){
 const pngs=new Map();
 for(const x of custody.sources)pngs.set(x.partId,await readFile(new URL(x.partId+'.png',root)));
 return buildR9dCandidateGodotProject({sourcePngs:pngs,custody,compiled});
}
test('R9d-07 narrows the two-visible-poses portion within original 55ms transition and preserves C→A',()=>{
 const mix=t=>sampleR9dFlameMix({sequence:frames,timeSeconds:t});
 for(const t of [.070,.075,.085,.090,.108,.115,.124,.125,1.999,2]){
  const p=mix(t);
  assert.ok(Math.abs(p.primary.alpha+p.secondary.alpha-1)<1e-6);
 }
 assert.ok(mix(.095).secondary.alpha<.32,'early overlap must be substantially below R9d-06 linear crossfade');
 assert.ok(mix(.105).secondary.alpha>.98,'late overlap must be substantially above R9d-06 linear crossfade');
 assert.ok(mix(.085).secondary.alpha<.02);
 assert.equal(mix(2).primary.pose,'flame_a');
});
test('R9d-07 synchronizes original in-cage underlight with same authored SpiritLight key times',async()=>{
 const out=await project();
 const scene=String(out.files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 const meta=JSON.parse(out.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
 assert.equal(meta.method,'R9D07_CONTRAST_AND_GHOST_POLISH');
 assert.equal(meta.exportAllowed,false);
 assert.equal(meta.artisticReview,'UNSCORED');
 assert.equal(meta.underlightTrack.source,'body/flame/SpiritLight:energy');
 assert.deepEqual(meta.underlightTrack.authoredKeyTimes,lightKeys.map(k=>k.time));
 assert.ok(meta.underlightTrack.times.length>lightKeys.length,
  'actual Godot bake must retain intermediate smoothstep samples');
 assert.equal(meta.underlightTrack.alpha.length,meta.underlightTrack.times.length);
 assert.ok(meta.underlightTrack.alpha.every(v=>v>=.64&&v<=.72),
  'source-derived underlight remains legible yet capped after real A/B art review');
 assert.ok(Math.max(...meta.underlightTrack.alpha)-Math.min(...meta.underlightTrack.alpha)<=.081,
  'pulsation must not reintroduce R9d-05 large cyan-area instability');
 const authoredLevels=lightKeys.map(k=>{
  const i=meta.underlightTrack.times.findIndex(t=>Math.abs(t-k.time)<=.000001);
  assert.ok(i>=0,'missing original SpiritLight energy anchor in baked scene');
  return meta.underlightTrack.alpha[i];
 });
 for(let i=1;i<lightKeys.length;i++)
  if(lightKeys[i].value>lightKeys[i-1].value)
   assert.ok(authoredLevels[i]>authoredLevels[i-1],
    'underlight must follow physical light-energy direction');
 assert.equal(meta.underlightTrack.alpha[0],meta.underlightTrack.alpha.at(-1),
  '2s loop must not flash');
 assert.equal((scene.match(/NodePath\("body\/CavityUnderlight:modulate"\)/g)||[]).length,1);
 assert.match(scene,/\[node name="CavityUnderlight" type="Sprite2D" parent="body"\]/);
 assert.equal((scene.match(/\[node name="SpiritLight" type="PointLight2D"/g)||[]).length,1);
 assert.ok(scene.includes('z_index = 6'));
 assert.equal(out.master.oraSha256,'f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361');
});
test('R9d-07 keeps unmodified real source/custody while decreasing underlight overexposure',async()=>{
 const out=await project();
 const meta=JSON.parse(out.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
 assert.equal(meta.underlight.sha256,
  (await import('node:crypto')).createHash('sha256')
   .update(out.files.get('assets/spirit_lantern/flame-underlight.png')).digest('hex'));
 assert.ok(meta.underlightTrack.alpha.every(v=>v>=.64&&v<=.72));
 assert.equal(out.master.sourcePaintings.length,8);
 assert.equal(out.atlas.regions.length,9);
 const paint=JSON.parse(out.files.get('assets/spirit_lantern/r9d-painting-source.json'));
 assert.equal(paint.rightsVerified,false);
});
