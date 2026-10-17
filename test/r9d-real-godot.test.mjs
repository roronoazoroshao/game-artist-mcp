import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildR9dCandidateGodotProject} from '../src/export/godot-r9d-candidate.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
const prefix=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',prefix),'utf8'));
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
async function pngs(){const out=new Map();for(const f of custody.sources)out.set(f.partId,await readFile(new URL(f.partId+'.png',prefix)));return out}
test('R9d actual AI-painted source is a nine-frame Godot atlas with truthful blocked rights',async()=>{
 const out=buildR9dCandidateGodotProject({sourcePngs:await pngs(),custody,compiled});
 assert.equal(out.atlas.regions.length,9);
 assert.equal(out.evidence.paintGeneratedBy,'Adobe Firefly');
 assert.equal(out.evidence.exportAllowed,false);
 assert.equal(out.evidence.artisticReview,'UNSCORED');
 assert.ok(out.files.get('assets/spirit_lantern/atlas.png').length>20000);
 const painting=JSON.parse(out.files.get('assets/spirit_lantern/r9d-painting-source.json'));
 assert.equal(painting.sourceCount,8);
 assert.equal(painting.providerOriginalAttested,false);
 assert.equal(painting.rightsVerified,false);
 assert.equal(painting.masterCanvas.width,1024);
 const asset=JSON.parse(out.files.get('assets/spirit_lantern/asset.json'));
 assert.equal(asset.paintedByAI,true);
 assert.equal(asset.commercialRightsCleared,false);
 assert.equal(asset.exportAllowed,false);
 const scene=String(out.files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(scene,/Atlas_flame_flame_d/);
 assert.match(scene,/length = 2/);
 assert.ok(![...out.files.keys()].some(x=>x.endsWith('sources/body.svg')));
});
test('R9d refuses false provider attestation at Godot packaging boundary',async()=>{
 await assert.rejects(async()=>buildR9dCandidateGodotProject({sourcePngs:await pngs(),custody:{...custody,rightsVerified:true},compiled}),/R9D_MASTER_REJECTED|R9D_GODOT_REJECTED/);
});
