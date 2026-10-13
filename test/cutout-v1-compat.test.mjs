import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {renderSvg} from '../src/core/render-svg.mjs';
import {exportGodotCutout} from '../src/export/godot-cutout.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const files=['body','flame','talisman_left','talisman_right','tassel'];
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const cutout=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
const LEGACY_SVG_SHA='2f8736b800d124f2f8c6bda268f5ee807f8b65da3fd76af32a03892ace3a7e0d';
const LEGACY_PART_SHAS=Object.freeze({
  "body": "a73aad1424325782c97051be1f4520f9b0f34fe0b5a0827760b8fe9e0b4de17a",
  "flame": "7bc063b49d2283188b62905ca93d5a71cd96cbd7447b6289ab807f6e3e95d3de",
  "talisman_left": "7200b0e3a12ccdae0b5a115c160bf51adc64079a9f5651392fa189ad4ab6bbc0",
  "talisman_right": "39a16ea47eadc9bcf221472055d1ca1e33906dca6b899f9ad602fe293d93b0f0",
  "tassel": "f28f5d675c5d80315dd75a5dc6280141e18c5cf49b562422c2f416750484075b"
});

test('frozen original v1 SVG stays byte-identical',()=>{
  assert.equal(sha(renderSvg(source)),LEGACY_SVG_SHA);
});

test('POC004 exports five exact legacy full-canvas textures',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ga-v1-hash-baseline-'));
 try{
   const output=join(dir,'godot');
   const result=await exportGodotCutout({document:source,cutout,outputDir:output});
   assert.equal(result.parts,5);
   const actual={};
   for(const id of files){
     const data=await readFile(join(output,'assets',cutout.assetId,'parts',id+'.svg'));
     actual[id]=sha(data);
   }
   // Fixed SHA-256 values extracted from first RED exact-head CI 38112134355 on unchanged POC004 output.
   assert.deepEqual(actual,LEGACY_PART_SHAS);
 } finally {await rm(dir,{recursive:true,force:true})}
});

test('v1 appearance still fails before creating exporter files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ga-v1-appearance-'));
 try{
   const painted=JSON.parse(JSON.stringify(source));
   painted.nodes[0].appearance={material:'metal'};
   await assert.rejects(exportGodotCutout({document:painted,cutout,outputDir:join(dir,'godot')}),/UNSUPPORTED_GODOT_APPEARANCE/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
