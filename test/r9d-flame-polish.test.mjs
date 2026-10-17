import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildR9dMaster} from '../src/ai-art/r9d-master.mjs';
import {buildGodotRasterCutout} from '../src/export/godot-raster-cutout.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {planR9dFlamePresentation} from '../src/ai-art/r9d-flame-polish.mjs';

const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,manifest,{revision:1});
const hash=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const sourcePngs=new Map();
 for(const row of custody.sources)sourcePngs.set(row.partId,await readFile(new URL(row.partId+'.png',root)));
 const master=buildR9dMaster({sourcePngs,custody});
 const atlas=buildGodotRasterCutout({ora:master.ora,compiled,bindings:master.bindings,ownership:master.ownership,origin:'R9A_IMPORTED_UNATTESTED'}).atlas;
 return {master,atlas,sourcePngs};
}
test('R9d-06 measures four source-bound cyan flame centroids without changing ORA or atlas',async()=>{
 const {master,atlas,sourcePngs}=await fixture();
 const oldOra=hash(master.ora),oldAtlas=hash(atlas.png);
 const result=planR9dFlamePresentation({master,atlas,rig:compiled.manifest,options:{custody}});
 assert.equal(result.poseSlots.length,4);
 assert.deepEqual(result.poseSlots.map(p=>p.poseId),['flame_a','flame_b','flame_c','flame_d']);
 for(const p of result.poseSlots){
  assert.ok(Number.isFinite(p.centroidMaster.x)&&Number.isFinite(p.centroidMaster.y));
  assert.ok(p.visibleCyanPixelCount>20);
  assert.ok(p.averageLuminance>0&&p.averageLuminance<=255);
  assert.match(p.sourcePaintingSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(p.localSpriteOffset[0])&&Number.isFinite(p.localSpriteOffset[1]));
  assert.ok(Math.abs(result.correctionByPose[p.poseId].offsetRuntime[0])<=2);
  assert.ok(Math.abs(result.correctionByPose[p.poseId].offsetRuntime[1])<=2);
  assert.ok(result.correctionByPose[p.poseId].intensity>=0.90);
  assert.ok(result.correctionByPose[p.poseId].intensity<=1.10);
 }
 assert.equal(result.provenance.sourceOraSha256,oldOra);
 assert.equal(result.provenance.atlasSha256,oldAtlas);
 assert.equal(hash(master.ora),oldOra);
 assert.equal(hash(atlas.png),oldAtlas);
 assert.equal(result.artisticReview,'UNSCORED');
 assert.equal(result.exportAllowed,false);
 assert.equal(result.underlightPng,null);
 for(const [id,original] of sourcePngs)assert.equal(hash(original),custody.sources.find(x=>x.partId===id).sha256);
});
test('R9d-06 rejects altered master ORA and source custody hashes',async()=>{
 const {master,atlas}=await fixture();
 assert.throws(()=>planR9dFlamePresentation({
  master:{...master,ora:Buffer.concat([master.ora,Buffer.from('unexpected')])},
  atlas,rig:compiled.manifest,options:{custody}
 }),/R9D_FLAME_POLISH_REJECTED/);
 const fake=structuredClone(custody);
 fake.sources.find(x=>x.partId==='flame_c').sha256='0'.repeat(64);
 assert.throws(()=>planR9dFlamePresentation({master,atlas,rig:compiled.manifest,options:{custody:fake}}),/R9D_FLAME_POLISH_REJECTED/);
});
test('R9d-06 rejects extra flame pose, incomplete atlas and forged export rights',async()=>{
 const {master,atlas}=await fixture();
 const badRig=structuredClone(compiled.manifest);
 badRig.poseVariants.push({part:'flame',id:'flame_e'});
 assert.throws(()=>planR9dFlamePresentation({master,atlas,rig:badRig,options:{custody}}),/R9D_FLAME_POLISH_REJECTED/);
 const badAtlas={...atlas,regions:atlas.regions.filter(x=>x.poseId!=='flame_d')};
 assert.throws(()=>planR9dFlamePresentation({master,atlas:badAtlas,rig:compiled.manifest,options:{custody}}),/R9D_FLAME_POLISH_REJECTED/);
 assert.throws(()=>planR9dFlamePresentation({master:{...master,exportAllowed:true},atlas,rig:compiled.manifest,options:{custody}}),/R9D_FLAME_POLISH_REJECTED/);
});
