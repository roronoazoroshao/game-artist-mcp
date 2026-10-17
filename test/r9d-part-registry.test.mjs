import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditR9dPartRegistry} from '../src/ai-art/r9d-part-registry.mjs';

const original=JSON.parse(await readFile(
 new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(original);
const fail=x=>assert.throws(()=>auditR9dPartRegistry(x),/R9D_REGISTRY_REJECTED/);
test('R9d registry lists eight real Adobe candidate requests without any false source/rights readiness',()=>{
 const x=auditR9dPartRegistry(original);
 assert.equal(x.status,'SOURCE_BYTES_NOT_ARCHIVED');
 assert.equal(x.candidateCount,8);
 assert.deepEqual(x.parts,['body','flame_a','flame_b','flame_c','flame_d','talisman_left','talisman_right','tassel']);
 assert.equal(x.sourcesArchived,0);
 assert.equal(x.rigAligned,false);
 assert.equal(x.exportAllowed,false);
 assert.equal(x.visualQuality,'UNSCORED');
 assert.equal(x.flamePosePixelDiversity,'NOT_RUN');
});
test('R9d registry rejects missing pose, duplicate request and untrusted output URL',()=>{
 const missing=copy();missing.operations.splice(3,1);fail(missing);
 const duplicate=copy();duplicate.operations[3].generationRequestId=duplicate.operations[2].generationRequestId;fail(duplicate);
 const url=copy();url.operations[2].cutoutOutputUrl='https://untrusted.invalid/out.png';fail(url);
});
test('R9d registry rejects self-certified source archival, rig quality and commercial release',()=>{
 const faked=copy();faked.operations[0].sourcePngStored=true;fail(faked);
 const fakedHash=copy();fakedHash.operations[0].sourcePngSha256='a'.repeat(64);fail(fakedHash);
 const fakedReady=copy();fakedReady.publication.editableRigLayers=true;fail(fakedReady);
 const fakedRights=copy();fakedRights.publication.commercialRightsVerified=true;fail(fakedRights);
 const fakedFlame=copy();fakedFlame.visualReview.flamePoseGate='PASS';fail(fakedFlame);
});
