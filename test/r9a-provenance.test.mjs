import test from 'node:test';
import assert from 'node:assert/strict';
import {makeProvenanceEvent,verifyProvenanceEvents,digestProvenanceEvents} from '../src/ai-art/provenance.mjs';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
function op(id,outputSha256=b){return {operationId:id,provider:'adobe_firefly',modelId:'firefly_image_4',targetPart:'body',promptSha256:a,inputSha256:null,maskSha256:null,outputSha256,accepted:true};}
test('R9a creates hash-bound immutable audit records with deterministic digest',()=>{
 const first=makeProvenanceEvent(op('op_0001'));
 const second=makeProvenanceEvent(op('op_0002',c),first.eventSha256);
 const check=verifyProvenanceEvents([first,second]);
 assert.equal(check.ok,true);
 assert.equal(check.headSha256,second.eventSha256);
 assert.match(digestProvenanceEvents([first,second]),/^[0-9a-f]{64}$/);
 assert.equal(digestProvenanceEvents([first,second]),digestProvenanceEvents([first,second]));
 assert.equal(first.prevSha256,null);
 assert.equal(Object.isFrozen(first),true);
});
test('R9a rejects tampered, reordered, duplicate, orphaned or fabricated events',()=>{
 const one=makeProvenanceEvent(op('op_0001'));
 const two=makeProvenanceEvent(op('op_0002',c),one.eventSha256);
 for(const evil of [
  [{...one,accepted:false},two],
  [two,one],
  [one,{...two,prevSha256:null}],
  [one,makeProvenanceEvent(op('op_0001',c),one.eventSha256)],
  [{...one,eventSha256:'f'.repeat(64)},two],
  [one,{...two,outputSha256:'bad'}],
  []
 ])assert.throws(()=>verifyProvenanceEvents(evil),/R9A_INVALID_PROVENANCE/,JSON.stringify(evil).slice(0,120));
 assert.throws(()=>makeProvenanceEvent({...op('op_0003'),extra:'sneaky'}),/R9A_INVALID_PROVENANCE/);
});
