import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compileCutout} from '../src/cutout/compile.mjs';
import {buildSpiritLanternOraDemo} from './r9b-spirit-lantern-ora.mjs';
import {buildGodotRasterCutout} from '../src/export/godot-raster-cutout.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'examples/spirit-lantern/generated/r9c-godot');
const source=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/source.json'),'utf8'));
const rig=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/cutout.json'),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
const {ora,evidence:legacyEvidence}=await buildSpiritLanternOraDemo();
assert.equal(legacyEvidence.origin,'LEGACY_VECTOR_ORA_TECHNICAL');
const ownership=new Map(),bindings=new Map();
for(const part of rig.parts){
 if(part.id!=='flame'){
  const id=part.id+'_base';
  ownership.set(id,{partId:part.id,poseId:null});
  bindings.set(part.id+'/base',[id]);
 }else{
  for(const pose of rig.poseVariants){
   const id='flame_'+pose.id;
   ownership.set(id,{partId:'flame',poseId:pose.id});
   bindings.set('flame/'+pose.id,[id]);
  }
  // Historical technical ORA omits the standalone flame base.
  // Explicitly reuse first pose, never fabricate another provenance origin.
  bindings.set('flame/base',['flame_flame_a']);
 }
}
const project=buildGodotRasterCutout({
 ora,compiled,bindings,ownership,origin:'LEGACY_VECTOR_RASTER_TECHNICAL'
});
const {files,atlas,evidence}=project;
assert.equal(atlas.regions.length,9);
assert.equal(evidence.artisticReview,'UNSCORED');
assert.equal(evidence.exportAllowed,false);
assert.equal(evidence.paintedByAI,false);
files.set('validation.gd',await readFile(join(root,'scripts/r9c-runtime-check.gd'),'utf8'));
files.set('r9c-capture.gd',await readFile(join(root,'scripts/r9c-capture.gd'),'utf8'));
files.set('r9c-capture.tscn',[
 '[gd_scene load_steps=3 format=3]','',
 '[ext_resource type="PackedScene" path="res://assets/spirit_lantern/spirit_lantern.tscn" id="Lantern"]',
 '[ext_resource type="Script" path="res://r9c-capture.gd" id="Capture"]','',
 '[node name="Capture" type="Node2D"]',
 'script = ExtResource("Capture")','',
 '[node name="SpiritLantern" parent="." instance=ExtResource("Lantern")]',
 'position = Vector2(128, 64)',''].join('\n'));
files.set('r9c-evidence.json',JSON.stringify({
 ...evidence,legacySource:'R8E_EXISTING_VECTOR_DERIVED_PNG_TECHNICAL',
 currentOrigin:'LEGACY_VECTOR_RASTER_TECHNICAL',
 realGodotRuntime:'REQUIRES_CI_VALIDATION',productionMasterPainted:false,
 sourceOraSha256:createHash('sha256').update(ora).digest('hex'),
 frameCount:atlas.regions.length,
 flamePoses:rig.poseVariants.map(p=>p.id),
 animationLengthSeconds:rig.animations[0].length
},null,2)+'\n');
await rm(out,{recursive:true,force:true});
for(const [path,bytes] of files){
 if(path.startsWith('/')||path.split('/').includes('..'))throw Error('unsafe project file path');
 const target=join(out,path);
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 await writeFile(target,bytes);
}
console.log('GAME_ARTIST_R9C_RASTER_PROJECT_BUILT');
console.log(JSON.stringify({dir:'examples/spirit-lantern/generated/r9c-godot',
 sourceOraSha256:evidence.sourceSha256,atlasSha256:atlas.atlasSha256,
 actualRasterFrames:atlas.regions.length,
 origin:evidence.origin,paintedByAI:false,artisticReview:'UNSCORED',
 rights:'BLOCKED'},null,2));
