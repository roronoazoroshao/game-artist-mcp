import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pngjs from 'pngjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
import {buildSpiritLanternOraDemo} from '../scripts/r9b-spirit-lantern-ora.mjs';
import {renderRasterFrames,downsampleStraightAlpha} from '../src/ai-art/raster-frame-provider.mjs';
import {buildGodotRasterCutout} from '../src/export/godot-raster-cutout.mjs';
const {PNG}=pngjs;
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,rig,{revision:11});

async function fixture(){
 const {ora,evidence}=await buildSpiritLanternOraDemo();
 const doc=readOpenRaster(ora);
 const ownership=new Map(),bindings=new Map();
 for(const p of rig.parts){
  if(p.id!=='flame'){
   const id=p.id+'_base';
   ownership.set(id,{partId:p.id,poseId:null});
   bindings.set(p.id+'/base',[id]);
  }else{
   for(const pose of rig.poseVariants){
    const id='flame_'+pose.id;
    ownership.set(id,{partId:'flame',poseId:pose.id});
    bindings.set('flame/'+pose.id,[id]);
   }
   bindings.set('flame/base',['flame_flame_a']); // explicitly labeled technical base-pose alias
  }
 }
 return {ora,doc,ownership,bindings,evidence};
}

test('R9c provider uses actual validated layer PNGs for nine frames and preserves exact part pivot',async()=>{
 const f=await fixture();
 const out=renderRasterFrames({ora:f.ora,compiled,bindings:f.bindings,ownership:f.ownership});
 assert.equal(out.origin,'LEGACY_VECTOR_RASTER_TECHNICAL');
 assert.equal(out.frames.length,9);
 assert.equal(out.sourceSha256,f.doc.sha256);
 assert.equal(out.masterWidth,256);
 const poses=out.frames.filter(x=>x.partId==='flame').map(x=>x.poseId);
 assert.deepEqual(poses,[null,'flame_a','flame_b','flame_c','flame_d']);
 for(const frame of out.frames){
  assert.equal(frame.sourceSha256,f.doc.sha256);
  assert.equal(frame.sourceRevision,11);
  assert.ok(frame.crop.width>0&&frame.crop.height>0);
  assert.ok(frame.crop.width<=256&&frame.crop.height<=320);
  const part=rig.parts.find(p=>p.id===frame.partId);
  assert.deepEqual(frame.pivotSource,part.pivot);
  assert.equal(frame.sourceSvgSha256,null);
 }
 assert.notDeepEqual(out.frames.find(x=>x.poseId==='flame_a').crop.pixels,
                     out.frames.find(x=>x.poseId==='flame_b').crop.pixels);
});
test('R9c provider fails closed on swapped ownership, missing frame, hidden pose and bad runtime scale',async()=>{
 const f=await fixture();
 const bad=new Map(f.bindings);bad.set('talisman_right/base',['flame_flame_a']);
 assert.throws(()=>renderRasterFrames({ora:f.ora,compiled,bindings:bad,ownership:f.ownership}),/R9C_/);
 const missing=new Map(f.bindings);missing.delete('flame/flame_d');
 assert.throws(()=>renderRasterFrames({ora:f.ora,compiled,bindings:missing,ownership:f.ownership}),/R9C_/);
 const corrupt=new Map(f.ownership);corrupt.set('flame_flame_b',{partId:'body',poseId:null});
 assert.throws(()=>renderRasterFrames({ora:f.ora,compiled,bindings:f.bindings,ownership:corrupt}),/R9C_/);
 assert.throws(()=>renderRasterFrames({ora:f.ora,compiled,bindings:f.bindings,ownership:f.ownership,
  runtimeCanvas:{width:512,height:640}}),/R9C_/);
});
test('R9c straight-alpha 4x downsample preserves chroma against transparent samples',()=>{
 const p=new PNG({width:4,height:4,colorType:6});
 p.data.set([255,20,10,255]);
 const out=PNG.sync.read(downsampleStraightAlpha(PNG.sync.write(p),4),{checkCRC:true});
 assert.deepEqual([out.width,out.height],[1,1]);
 assert.deepEqual([...out.data],[255,20,10,16]);
});
test('R9c Godot project uses raster AtlasTexture, four flame poses, light and audit source truth',async()=>{
 const f=await fixture();
 const {files,atlas,evidence}=buildGodotRasterCutout({ora:f.ora,compiled,bindings:f.bindings,ownership:f.ownership,
  origin:'LEGACY_VECTOR_RASTER_TECHNICAL'});
 assert.equal(atlas.regions.length,9);
 assert.equal(evidence.paintedByAI,false);
 assert.equal(evidence.exportAllowed,false);
 assert.equal(evidence.artisticReview,'UNSCORED');
 const scene=String(files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(scene,/Animation_flame_/i);
 assert.match(scene,/tracks\/\d+\/path = NodePath\("body\/flame\/Sprite2D:texture"\)/);
 assert.match(scene,/length = 2/);
 assert.match(scene,/SpiritLight/);
 assert.ok(Buffer.isBuffer(files.get('assets/spirit_lantern/atlas.png')));
 assert.ok(![...files.keys()].some(p=>/\/sources\/.*\.svg$/.test(p)),
   'vector-painted source backup must not masquerade as raster asset');
 assert.ok(!files.has('assets/spirit_lantern/source.json'),
   'legacy vector source.json must not masquerade as imported raster art');
 assert.equal(JSON.parse(files.get('assets/spirit_lantern/raster-source.json')).oraSha256,f.doc.sha256);
});
