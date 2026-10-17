import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertR9dAcquisitionRecord} from '../scripts/r9d-source-probe.mjs';
const manifest=JSON.parse(await readFile(new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
const candidate=manifest.operations.find(x=>x.partId==='body');
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
