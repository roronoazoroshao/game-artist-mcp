import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {buildSpiritLanternOraDemo} from '../scripts/r9b-spirit-lantern-ora.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
const {PNG}=pngjs;

test('R9b produces a real editable ORA from canonical Spirit Lantern part rasters without claiming AI art',async()=>{
 const result=await buildSpiritLanternOraDemo();
 assert.ok(Buffer.isBuffer(result.ora)&&result.ora.length>500);
 assert.equal(result.evidence.origin,'LEGACY_VECTOR_ORA_TECHNICAL');
 assert.equal(result.evidence.artisticReview,'UNSCORED');
 assert.equal(result.evidence.partCount,5);
 assert.deepEqual(result.evidence.flamePoseIds,['flame_a','flame_b','flame_c','flame_d']);
 const doc=readOpenRaster(result.ora);
 assert.deepEqual([doc.width,doc.height],[256,320]);
 const names=doc.layers.map(l=>l.id);
 assert.ok(names.includes('body_base'));
 for(const name of ['flame_flame_a','flame_flame_b','flame_flame_c','flame_flame_d'])assert.ok(names.includes(name));
 assert.equal(doc.layers.filter(l=>l.id.startsWith('flame_')&&l.visible).length,1);
 const render=PNG.sync.read(doc.mergedPng,{checkCRC:true});
 assert.equal(render.width,256);
 assert.ok(render.data.some((v,i)=>i%4===3&&v>0),'merged silhouette must not be empty');
 assert.equal(result.evidence.oraSha256,doc.sha256);
});
