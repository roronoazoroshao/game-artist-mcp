import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildR9dMaster} from '../src/ai-art/r9d-master.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
import {renderRasterFrames} from '../src/ai-art/raster-frame-provider.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';

const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const compiled=compileCutout(source,rig,{revision:1});
async function inputs(){
 const layerBytes=new Map();
 for(const item of custody.sources)layerBytes.set(item.partId,await readFile(new URL(item.partId+'.png',root)));
 return layerBytes;
}
test('R9d produces real 1024x1280 editable ORA from eight independent Firefly SHA-verified alpha PNGs',async()=>{
 const art=buildR9dMaster({sourcePngs:await inputs(),custody});
 const doc=readOpenRaster(art.ora);
 assert.deepEqual([doc.width,doc.height],[1024,1280]);
 assert.equal(doc.layers.length,8);
 assert.equal(art.sourcePaintings.length,8);
 assert.equal(art.maskPngs.size,8);
 assert.equal(art.artisticReview,'UNSCORED');
 assert.equal(art.exportAllowed,false);
 assert.equal(art.providerOriginalAttested,false);
 assert.ok(art.oraSha256===createHash('sha256').update(art.ora).digest('hex'));
 assert.equal(art.paintGeneratedBy,'Adobe Firefly');
 assert.equal(art.placements.body.width,776);
 assert.equal(doc.layers.filter(l=>l.id.startsWith('flame_')).filter(l=>l.visible).length,1);
 const frames=renderRasterFrames({ora:art.ora,compiled,bindings:art.bindings,ownership:art.ownership});
 assert.equal(frames.frames.length,9);
 assert.equal(frames.masterWidth,1024);
 assert.equal(frames.origin,'R9A_IMPORTED_UNATTESTED');
 for(const frame of frames.frames)assert.equal(frame.sourceSvgSha256,null);
});
test('R9d rejects any mutated original source PNG even when it remains a valid PNG',async()=>{
 const inputs2=await inputs(),t=inputs2.get('flame_c'),mut=Buffer.from(t);
 mut[mut.length-16]^=1; inputs2.set('flame_c',mut);
 assert.throws(()=>buildR9dMaster({sourcePngs:inputs2,custody}),/R9D_MASTER_REJECTED/);
});
test('R9d rejects forged rights, incomplete masks/parts or layout claims',async()=>{
 const pngs=await inputs();
 assert.throws(()=>buildR9dMaster({sourcePngs:pngs,custody:{...custody,rightsVerified:true}}),/R9D_MASTER_REJECTED/);
 const missing=new Map(pngs);missing.delete('talisman_right');
 assert.throws(()=>buildR9dMaster({sourcePngs:missing,custody}),/R9D_MASTER_REJECTED/);
});
