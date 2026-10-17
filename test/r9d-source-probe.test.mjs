import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertR9dAcquisitionRecord} from '../scripts/r9d-source-probe.mjs';
const manifest=JSON.parse(await readFile(new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
const candidate=manifest.operations.find(x=>x.partId==='body');
const ALL=['body','flame_a','flame_b','flame_c','flame_d','talisman_left','talisman_right','tassel'];
test('R9d Adobe direct source probe accepts only exact allowlisted body output and unreleased status',()=>{
 assert.equal(assertR9dAcquisitionRecord(candidate).partId,'body');
});
test('R9d acquisition must reject redirected arbitrary URL, false rights or wrong body part',()=>{
 for(const wrong of [
  {...candidate,cutoutOutputUrl:'https://example.org/unsafe.png'},
  {...candidate,cutoutOutputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:ffffffff-ffff-ffff-ffff-ffffffffffff'},
  {...candidate,commercialRightsCleared:true},
  {...candidate,sourcePngStored:true},
  {...candidate,partId:'flame_a'}
 ])assert.throws(()=>assertR9dAcquisitionRecord(wrong),/R9D_ACQUISITION_REJECTED/);
});

test('R9d source acquisition supports all eight canonical provider cutouts',()=>{
 assert.deepEqual(manifest.operations.map(x=>x.partId),ALL);
 for(const entry of manifest.operations)assert.equal(assertR9dAcquisitionRecord(entry).partId,entry.partId);
});
test('R9d source transfer must reject a forged pose URL, metadata size and claimed source hash',()=>{
 const first=manifest.operations.find(x=>x.partId==='flame_c');
 assert.throws(()=>assertR9dAcquisitionRecord({...first,cutoutOutputUrl:candidate.cutoutOutputUrl}),/R9D_ACQUISITION_REJECTED/);
 assert.throws(()=>assertR9dAcquisitionRecord({...first,outputCanvas:{width:1360,height:1744}}),/R9D_ACQUISITION_REJECTED/);
 assert.throws(()=>assertR9dAcquisitionRecord({...first,sourcePngSha256:'a'.repeat(64)}),/R9D_ACQUISITION_REJECTED/);
});
