import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {buildR9dMaster} from '../src/ai-art/r9d-master.mjs';
import {deriveR9dFrontCageRail} from '../src/ai-art/r9d-depth-occlusion.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
const {PNG}=pngjs;
const root=new URL('../examples/spirit-lantern/r9d/parts/sources/',import.meta.url);
const custody=JSON.parse(await readFile(new URL('source-custody-001.json',root),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function master(){
 const byPart=new Map();
 for(const item of custody.sources)byPart.set(item.partId,await readFile(new URL(item.partId+'.png',root)));
 return buildR9dMaster({sourcePngs:byPart,custody});
}
function rgba(png,x,y){
 const p=PNG.sync.read(png,{checkCRC:true});
 return [...p.data.subarray(4*(y*p.width+x),4*(y*p.width+x)+4)];
}
test('R9d-05: real front bronze rail is derived only from original Firefly body source pixels',async()=>{
 const art=await master(),originalSha=sha(art.ora),doc=readOpenRaster(art.ora);
 const body=doc.layers.find(l=>l.id==='body_base');
 assert.ok(body);
 const original=PNG.sync.read(body.png,{checkCRC:true});
 const actual=deriveR9dFrontCageRail({ora:art.ora});
 assert.equal(sha(art.ora),originalSha,'immutable source ORA is unchanged');
 assert.equal(actual.sourceOraSha256,originalSha);
 assert.equal(actual.sourceBodySha256,sha(body.png));
 assert.equal(actual.maskType,'AUTHORED_CONSERVATIVE_FRONT_RAIL');
 const overlay=PNG.sync.read(actual.masterPng,{checkCRC:true});
 assert.deepEqual([overlay.width,overlay.height],[1024,1280]);
 assert.deepEqual([rgba(actual.runtimePng,0,0)[3],rgba(actual.masterPng,540,650)[3]],[0,0]);
 const sample=rgba(actual.masterPng,488,650);
 const bodySample=[...original.data.subarray(4*((650-body.y)*original.width+488-body.x),4*((650-body.y)*original.width+488-body.x)+4)];
 assert.ok(sample[3]>=240,'the actual center bronze support must occlude the flame');
 assert.deepEqual(sample,bodySample,'overlay must retain untouched source body RGBA');
 assert.ok(actual.railOverFlamePixels>100,'rail must cover real flame/body crossing, not decoration only');
 assert.ok(actual.visibleRailPixels>2000);
 assert.equal(actual.artisticReview,'UNSCORED');
 assert.equal(actual.exportAllowed,false);
});
test('R9d-05: reject unknown source, wrong alpha canvas or altered original without forging source rights',async()=>{
 const art=await master();
 assert.throws(()=>deriveR9dFrontCageRail({ora:Buffer.from('unsafe')}),/R9D_DEPTH_REJECTED/);
 assert.throws(()=>deriveR9dFrontCageRail({ora:art.ora,expectedOraSha256:'0'.repeat(64)}),/R9D_DEPTH_REJECTED/);
});
