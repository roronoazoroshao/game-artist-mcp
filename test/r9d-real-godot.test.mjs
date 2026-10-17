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

test('R9d-05: actual derived front brass cage rail sits above flame without modifying nine original frames',async()=>{
 const out=buildR9dCandidateGodotProject({sourcePngs:await pngs(),custody,compiled});
 const scene=String(out.files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(scene,/\[node name="FrontCageRail" type="Sprite2D" parent="body"\]/);
 assert.match(scene,/\[ext_resource type="Texture2D" path="res:\/\/assets\/spirit_lantern\/foreground-rail.png" id="R9dForeground"\]/);
 assert.match(scene,/\[node name="FrontCageRail"[^\[]+z_index = 6/s);
 assert.match(scene,/\[node name="FrontCageRail"[^\[]+position = Vector2\(-128, -160\)/s);
 const overlay=out.files.get('assets/spirit_lantern/foreground-rail.png');
 assert.ok(Buffer.isBuffer(overlay));
 const metadata=JSON.parse(out.files.get('assets/spirit_lantern/r9d-occlusion.json'));
 assert.equal(metadata.type,'AUTHORED_CONSERVATIVE_FRONT_RAIL');
 assert.equal(metadata.sourceBodySha256,out.master.sourcePaintings[0].derivedLayerSha256);
 assert.equal(metadata.exportAllowed,false);
 assert.equal(out.atlas.regions.length,9,'no legacy/hidden replacement pose frame');
 assert.equal(out.master.sourcePaintings.length,8,'all original Firefly source layers preserved');
});

test('R9d-06: Godot candidate integrates real two-sprite flame under existing bronze and one masked underlight',async()=>{
 const out=buildR9dCandidateGodotProject({sourcePngs:await pngs(),custody,compiled});
 const scene=String(out.files.get('assets/spirit_lantern/spirit_lantern.tscn'));
 assert.match(scene,/\[node name="SpriteBlend2D" type="Sprite2D" parent="body\/flame"\]/);
 assert.match(scene,/\[node name="CavityUnderlight" type="Sprite2D" parent="body"\]/);
 assert.match(scene,/body\/flame\/Sprite2D:modulate/);
 assert.match(scene,/body\/flame\/SpriteBlend2D:modulate/);
 assert.equal((scene.match(/\[node name="SpiritLight" type="PointLight2D"/g)||[]).length,1);
 assert.equal((scene.match(/\[node name="FrontCageRail"/g)||[]).length,1);
 assert.ok(Buffer.isBuffer(out.files.get('assets/spirit_lantern/flame-underlight.png')));
 const info=JSON.parse(out.files.get('assets/spirit_lantern/r9d-flame-polish.json'));
 assert.equal(info.transitionMs,55);
 assert.equal(info.sourceOraSha256,out.master.oraSha256);
 assert.equal(info.exportAllowed,false);
 assert.equal(info.artisticReview,'UNSCORED');
 assert.equal(out.atlas.regions.length,9);
 assert.equal(out.master.sourcePaintings.length,8);
});
