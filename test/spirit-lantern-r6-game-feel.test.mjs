import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCutout} from '../src/cutout/compile.mjs';
import {auditLoop,sampleAnimation} from '../src/cutout/animation.mjs';
import {renderCutoutFrames} from '../src/cutout/raster.mjs';
import {packAtlas} from '../src/cutout/atlas.mjs';
import {buildGodotV2Project} from '../src/export/godot-cutout-v2.mjs';

const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const cutout=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,cutout,{revision:1});

test('R6 lantern idle breathes while flame follows its own irregular drift',()=>{
 const start=sampleAnimation(compiled,'idle',0);
 const high=sampleAnimation(compiled,'idle',1);
 const right=sampleAnimation(compiled,'idle',0.25);
 const left=sampleAnimation(compiled,'idle',0.6);
 const end=sampleAnimation(compiled,'idle',2);
 assert.ok(high.parts.body.position[1] < -0.7,
   'lantern body should float by at least 0.7 authored canvas pixels at the breathing apex');
 assert.ok(Math.abs(right.parts.flame.position[0]-left.parts.flame.position[0]) > 1.2,
   'flame should drift horizontally independent of pose switches');
 assert.ok(left.parts.flame.position[1] < -0.7,
   'flame should rise within its glass chamber without teleporting');
 assert.deepEqual(end.parts.body.position,start.parts.body.position);
 assert.deepEqual(end.parts.flame.position,start.parts.flame.position);
});

test('R6 secondary motion lags the body without uniform mirrored paper keys',()=>{
 const at0=sampleAnimation(compiled,'idle',0);
 const at05=sampleAnimation(compiled,'idle',0.5);
 const at10=sampleAnimation(compiled,'idle',1);
 assert.notDeepEqual(at05.parts.talisman_left.position,at0.parts.talisman_left.position);
 assert.notDeepEqual(at05.parts.talisman_right.position,at0.parts.talisman_right.position);
 assert.notDeepEqual(at05.parts.talisman_left.position,at05.parts.talisman_right.position);
 assert.ok(at10.parts.tassel.position[1] > 0.5,'tassel must settle below its authored pivot');
 const qa=auditLoop(compiled,'idle');
 assert.equal(qa.ok,true,qa.errors.join('; '));
 assert.ok(qa.metrics.maxStepDelta < 4,'motion must remain within animation-step QA');
});

test('R6 spirit fire uses deliberately varied yet seamless luminous pulsation',()=>{
 const track=cutout.animations[0].tracks.find(t=>t.part==='flame'&&t.property==='light_energy');
 assert.ok(track.keys.length>=10,'irregular flicker needs authored micro-beats, not a single sine wave');
 const values=track.keys.map(k=>k.value);
 assert.ok(Math.max(...values)-Math.min(...values)>=0.2,'light needs visible pulsation');
 assert.ok(Math.max(...values)<=1.25 && Math.min(...values)>=0.7,'light must stay within restrained range');
 const between=sampleAnimation(compiled,'idle',0.32).lightEnergy;
 const next=sampleAnimation(compiled,'idle',0.86).lightEnergy;
 assert.ok(Math.abs(between-next)>0.12,'flicker must vary over subsecond beats');
 assert.equal(sampleAnimation(compiled,'idle',0).lightEnergy,sampleAnimation(compiled,'idle',2).lightEnergy);
});

test('R6 exported Godot light falloff uses soft outer pool and focused core',async()=>{
 const frames=await renderCutoutFrames(compiled);
 const atlas=packAtlas(frames,compiled.manifest.rendering);
 const project=buildGodotV2Project(compiled,atlas,auditLoop(compiled,'idle'));
 const svg=String(project.get('assets/spirit_lantern/light.svg'));
 const scene=String(project.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(svg,/radialGradient id="outer"/);
 assert.match(svg,/radialGradient id="core"/);
 assert.match(svg,/stop-opacity="0"/);
 assert.match(scene,/NodePath\("body:position"\)/);
 assert.match(scene,/NodePath\("body\/flame:position"\)/);
 assert.match(scene,/NodePath\("body\/flame\/SpiritLight:energy"\)/);
 assert.match(scene,/texture = ExtResource\("LightSource"\)/);
});
