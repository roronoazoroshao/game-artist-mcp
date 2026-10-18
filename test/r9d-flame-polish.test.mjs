import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {deriveR9dFrontCageRail} from '../src/ai-art/r9d-depth-occlusion.mjs';
const {PNG}=pngjs;
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
 assert.ok(Buffer.isBuffer(result.underlightPng));
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

test('R9d-06 underlight emits real low-alpha cyan pixels only in authored inner cavity',async()=>{
 const {master,atlas}=await fixture();
 const p=planR9dFlamePresentation({master,atlas,rig:compiled.manifest,options:{custody}});
 assert.ok(Buffer.isBuffer(p.underlightPng));
 const im=PNG.sync.read(p.underlightPng,{checkCRC:true});
 assert.deepEqual([im.width,im.height],[256,320]);
 let positive=0,maxAlpha=0;
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
  const q=4*(y*im.width+x),a=im.data[q+3];
  maxAlpha=Math.max(maxAlpha,a);
  if(a>0){
   positive++;
   assert.ok(im.data[q+1]>=im.data[q]&&im.data[q+2]>=im.data[q],
    'soft derived light should be cyan, not a bronze recolor');
   const mx=x*4+2,my=y*4+2;
   assert.ok(mx>=416&&mx<=614&&my>=468&&my<=822,
    'no light outside bounded inner cavity');
  }
 }
 assert.ok(positive>=100,'actual source-flame-driven underlight must not be empty');
 assert.ok(maxAlpha<=46,'derived texture must be restrained');
 assert.equal(p.provenance.underlight.sha256,hash(p.underlightPng));
 assert.equal(p.provenance.underlight.railOverlapPixels,0);
 assert.equal(p.provenance.underlight.artisticReview,'UNSCORED');
});
test('R9d-06 underlight never touches original opaque bronze foreground rail',async()=>{
 const {master,atlas}=await fixture();
 const overlay=deriveR9dFrontCageRail({ora:master.ora,expectedOraSha256:master.oraSha256});
 const front=PNG.sync.read(overlay.runtimePng,{checkCRC:true});
 const p=planR9dFlamePresentation({master,atlas,rig:compiled.manifest,options:{custody}});
 const glow=PNG.sync.read(p.underlightPng,{checkCRC:true});
 for(let i=3;i<front.data.length;i+=4)if(front.data[i]>=96)
  assert.equal(glow.data[i],0,'must leave front bronze fully unilluminated');
 assert.equal(hash(master.ora),'f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361');
});
test('R9d-06 underlight refuses untrusted mask geometry and excessive alpha',async()=>{
 const {master,atlas}=await fixture();
 assert.throws(()=>planR9dFlamePresentation({master,atlas,rig:compiled.manifest,
  options:{custody,cavityBounds:{x:-500,y:-1,width:9999,height:9999}}
 }),/R9D_FLAME_POLISH_REJECTED/);
 assert.throws(()=>planR9dFlamePresentation({master,atlas,rig:compiled.manifest,
  options:{custody,maxUnderlightAlpha:150}
 }),/R9D_FLAME_POLISH_REJECTED/);
});
