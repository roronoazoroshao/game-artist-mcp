import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyR9dCandidate} from '../scripts/r9d-verify-candidate.mjs';

const evidence=JSON.parse(await readFile(new URL('../examples/spirit-lantern/r9d/concept/candidate-001-evidence.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('../examples/spirit-lantern/r9d/concept/candidate-001-firefly-rendition.jpg',import.meta.url));
const invalid=fn=>assert.throws(fn,/R9D_CONCEPT_REJECTED/);

test('R9d real Firefly concept is a new source, NOT a painted editable rig or commercial proof',()=>{
 const verified=verifyR9dCandidate({bytes,evidence});
 assert.equal(verified.origin,'ADOBE_FIREFLY_LIVE_GENERATION');
 assert.equal(verified.artifactKind,'JPEG_RENDITION_NOT_MASTER');
 assert.equal(verified.actualFileType,'JPEG');
 assert.ok(verified.width>=512&&verified.height>=512);
 assert.equal(verified.paintedByAI,true,'record only genuine new concept pixels, not a validated rig');
 assert.equal(verified.exportAllowed,false);
 assert.equal(verified.editableRigLayers,false);
 assert.equal(verified.commercialRightsCleared,false);
 assert.match(verified.sha256,/^[a-f0-9]{64}$/);
});

test('R9d fail closed on mutated bytes, fabricated origin/rights and missing provider identity',()=>{
 invalid(()=>verifyR9dCandidate({bytes:Buffer.from('old vector source'),evidence}));
 invalid(()=>verifyR9dCandidate({bytes:bytes.subarray(0,bytes.length-20),evidence}));
 invalid(()=>verifyR9dCandidate({bytes,evidence:{...evidence,origin:'LEGACY_VECTOR_ORA_TECHNICAL'}}));
 invalid(()=>verifyR9dCandidate({bytes,evidence:{...evidence,editableRigLayers:true}}));
 invalid(()=>verifyR9dCandidate({bytes,evidence:{...evidence,commercialRightsCleared:true}}));
 invalid(()=>verifyR9dCandidate({bytes,evidence:{...evidence,modelVersion:'fictional verified version'}}));
 invalid(()=>verifyR9dCandidate({bytes,evidence:{...evidence,providerRequestId:null}}));
});
