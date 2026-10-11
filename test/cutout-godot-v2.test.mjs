import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCutout} from '../src/cutout/compile.mjs';
import {renderCutoutFrames} from '../src/cutout/raster.mjs';
import {packAtlas} from '../src/cutout/atlas.mjs';
import {auditLoop} from '../src/cutout/animation.mjs';
import {buildGodotV2Project} from '../src/export/godot-cutout-v2.mjs';
import {exportGodotCutout} from '../src/export/godot-cutout.mjs';

const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const original=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
async function fixture(){
 const doc=structuredClone(source),cut=structuredClone(original);
 doc.nodes.push({id:'flame_alt_a',type:'ellipse',cx:127,cy:173,rx:8,ry:17,fill:'#72f5ec'});
 doc.nodes.push({id:'flame_alt_b',type:'ellipse',cx:129,cy:171,rx:10,ry:19,fill:'#b9fff4'});
 cut.version=2;
 cut.rendering={format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1};
 cut.poseVariants=[{id:'flame_a',part:'flame',nodes:['flame_alt_a']},{id:'flame_b',part:'flame',nodes:['flame_alt_b']}];
 cut.frameSequence={part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true};
 cut.animations[0].tracks.push({part:'flame',property:'light_energy',keys:[{time:0,value:0.85},{time:1,value:1.05},{time:2,value:0.85}]});
 const compiled=compileCutout(doc,cut,{revision:5});
 const frames=await renderCutoutFrames(compiled,{});
 const atlas=packAtlas(frames,{maxAtlasSize:2048,paddingPx:4});
 return {doc,cut,compiled,atlas,qa:auditLoop(compiled,'idle')};
}
test('pure Godot project builder includes atlas, five cutout parts, animations and typed startup gate',async()=>{
 const {compiled,atlas,qa}=await fixture();
 assert.equal(qa.ok,true,qa.errors.join('; '));
 const files=buildGodotV2Project(compiled,atlas,qa);
 assert.ok(files instanceof Map);
 for(const f of ['project.godot','main.tscn','validation.gd','assets/spirit_lantern/atlas.png','assets/spirit_lantern/atlas.json','assets/spirit_lantern/spirit_lantern.tscn','assets/spirit_lantern/asset.json']){
  assert.ok(files.has(f),f);
 }
 assert.ok(Buffer.isBuffer(files.get('assets/spirit_lantern/atlas.png')));
 const scene=String(files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(scene,/\[sub_resource type="AtlasTexture"/);
 assert.match(scene,/filter_clip = true/);
 assert.match(scene,/tracks\/\d+\/path = NodePath\("body\/flame\/Sprite2D:texture"\)/);
 assert.match(scene,/tracks\/\d+\/path = NodePath\("body\/flame\/Sprite2D:position"\)/);
 assert.match(scene,/tracks\/\d+\/path = NodePath\("body\/flame\/SpiritLight:energy"\)/);
 assert.match(scene,/SubResource\("Atlas_flame_flame_a"\)/);
 assert.match(scene,/SubResource\("Atlas_flame_flame_b"\)/);
 for(const name of ['body','flame','talisman_left','talisman_right','tassel'])assert.match(scene,new RegExp('\\[node name="'+name+'" type="Node2D"'));
 assert.match(String(files.get('validation.gd')),/GAME_ARTIST_PHASE3_OK/);
 assert.match(String(files.get('validation.gd')),/Array\[String\]/);
});
test('atlas offsets track actual varying pose crop centers and no client script/resource traversal',async()=>{
 const {compiled,atlas,qa}=await fixture();
 const files=buildGodotV2Project(compiled,atlas,qa);
 const json=JSON.parse(files.get('assets/spirit_lantern/atlas.json'));
 assert.equal(json.sourceRevision,5);
 assert.equal(json.atlasSha256,atlas.atlasSha256);
 assert.equal(json.regions.length,7);
 const scene=files.get('assets/spirit_lantern/spirit_lantern.tscn');
 for(const pose of ['flame_a','flame_b']){
  const r=atlas.regions.find(x=>x.partId==='flame'&&x.poseId===pose);
  assert.ok(scene.includes('Vector2('+r.localSpriteOffset.join(', ')+')'));
 }
 assert.ok([...files.keys()].every(x=>!x.includes('..')&&!x.startsWith('/')));
 const broken=structuredClone(compiled);
 broken.manifest.assetId='../evil';
 assert.throws(()=>buildGodotV2Project(broken,atlas,qa),/asset|invalid|safe/i);
});
test('legacy exporter rejects v2 without writing v1 SVG output',async()=>{
 const {doc,cut}=await fixture();
 await assert.rejects(exportGodotCutout({document:doc,cutout:cut,outputDir:'/tmp/this-must-not-be-created'}),/v2|compiled|unsupported|outputDir|manifest/i);
});
