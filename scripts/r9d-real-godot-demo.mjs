import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compileCutout} from '../src/cutout/compile.mjs';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sources=join(root,'examples/spirit-lantern/r9d/parts/sources');
const baseline=process.env.R9D_RENDER_VARIANT==='R9D05_BASELINE';
if(process.env.R9D_RENDER_VARIANT!==undefined&&
   !['R9D05_BASELINE','R9D06_HYBRID'].includes(process.env.R9D_RENDER_VARIANT))
 throw Error('R9D_RENDER_VARIANT_REJECTED');
const out=join(root,'examples/spirit-lantern/generated/'+
 (baseline?'r9d-05-baseline-godot':'r9d-godot'));
const masterOut=join(root,'examples/spirit-lantern/generated/r9d-master');
const custody=JSON.parse(await readFile(join(sources,'source-custody-001.json'),'utf8'));
const sourcePngs=new Map();
for(const row of custody.sources){
 if(!/^[a-z_]+$/.test(row.partId))throw Error('unsafe R9d part id');
 sourcePngs.set(row.partId,await readFile(join(sources,row.partId+'.png')));
}
const canonicalSource=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/source.json'),'utf8'));
const rig=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/cutout.json'),'utf8'));
const compiled=compileCutout(canonicalSource,rig,{revision:1});
const result=buildR9dCandidateGodotProject({sourcePngs,custody,compiled,hybridFlame:!baseline});
assert.equal(result.atlas.regions.length,9);
assert.equal(result.evidence.exportAllowed,false);
const {files,master}=result;
files.set('validation.gd',await readFile(join(root,baseline?'scripts/r9c-runtime-check.gd':'scripts/r9d-06-runtime-check.gd'),'utf8'));
files.set('r9c-capture.gd',await readFile(join(root,'scripts/r9c-capture.gd'),'utf8'));
files.set('r9c-capture.tscn',[
 '[gd_scene load_steps=3 format=3]','',
 '[ext_resource type="PackedScene" path="res://assets/spirit_lantern/spirit_lantern.tscn" id="Lantern"]',
 '[ext_resource type="Script" path="res://r9c-capture.gd" id="Capture"]','',
 '[node name="Capture" type="Node2D"]','script = ExtResource("Capture")','',
 '[node name="SpiritLantern" parent="." instance=ExtResource("Lantern")]',
 'position = Vector2(128, 64)',''].join('\n'));
files.set('r9d-motion-capture.gd',await readFile(join(root,'scripts/r9d-motion-capture.gd'),'utf8'));
files.set('r9d-motion-capture.tscn',[
 '[gd_scene load_steps=3 format=3]','',
 '[ext_resource type="PackedScene" path="res://assets/spirit_lantern/spirit_lantern.tscn" id="Lantern"]',
 '[ext_resource type="Script" path="res://r9d-motion-capture.gd" id="Capture"]','',
 '[node name="Capture" type="Node2D"]','script = ExtResource("Capture")','',
 '[node name="SpiritLantern" parent="." instance=ExtResource("Lantern")]',
 'position = Vector2(128, 64)',''].join('\n'));
files.set('r9d-evidence.json',JSON.stringify({
 origin:'R9D_REAL_ADOBE_PAINTED_COMPONENTS_CANDIDATE',paintedByAI:true,
 presentationVariant:baseline?'R9D05_BASELINE':'R9D06_HYBRID',
 sourceAuthenticity:'UNATTESTED_EXTERNAL_PROVIDER_REQUEST_AND_VERIFIED_BYTES',
 sourcePngSha256s:Object.fromEntries(custody.sources.map(x=>[x.partId,x.sha256])),
 sourceOriSha256:master.oraSha256,
 frameCount:9,flamePoseIds:rig.poseVariants.map(x=>x.id),
 animationLengthSeconds:2,rigRenderPhase:'REQUIRES_REAL_GODOT_CI',
 commercialRightsCleared:false,artisticReview:'UNSCORED',exportAllowed:false
 },null,2)+'\n');
await rm(out,{recursive:true,force:true});
for(const [path,bytes] of files){
 if(path.startsWith('/')||path.split('/').includes('..'))throw Error('unsafe Godot asset');
 const target=join(out,path);
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 await writeFile(target,bytes);
}
await rm(masterOut,{recursive:true,force:true});
await mkdir(masterOut,{recursive:true});
await writeFile(join(masterOut,'spirit-lantern-r9d-1024x1280-TECHNICAL.ora'),master.ora);
await writeFile(join(masterOut,'master-preview-A-TECHNICAL.png'),
 readOpenRaster(master.ora).mergedPng);
for(const [maskPath,bytes] of master.maskPngs){
 const target=join(masterOut,maskPath);
 await mkdir(dirname(target),{recursive:true});
 await writeFile(target,bytes);
}
await writeFile(join(masterOut,'master-source-evidence.json'),
 JSON.stringify({orAProjectSha256:master.oraSha256,
  sha256:createHash('sha256').update(master.ora).digest('hex'),
  sourcePaintings:master.sourcePaintings,
  sourceAuthentication:master.sourceAuthentication,
  masks:'DERIVED_ALPHA_PNG_SIDECARS_NOT_NATIVE_EDITOR_MASKS',
  artisticReview:'UNSCORED',commercialRightsCleared:false,
  exportAllowed:false},null,2)+'\n');
console.log('GAME_ARTIST_R9D_REAL_8_PAINT_MASTER_AND_GODOT_PROJECT_BUILT');
console.log(JSON.stringify({oraSha256:master.oraSha256,atlasSha256:result.atlas.atlasSha256,
 sourceCount:8,flamePoseCount:4,providerOriginalAttested:false,
 artisticReview:'UNSCORED',exportAllowed:false}));
