import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChallenge,validateInvocationEvent,validateExportEvidence,verifyBriefCommitment} from '../src/provenance/contracts.mjs';
import {challengeFixture,eventFixture,exportFixture,TEST_BRIEF} from './fixtures/provenance-fixtures.mjs';
test('accepts bounded synthetic contract, not evidence of live provenance',()=>{
 assert.equal(validateChallenge(challengeFixture).evidenceKind,'SYNTHETIC_TEST');
 assert.equal(validateInvocationEvent(eventFixture).eventSequence,0);
 assert.equal(validateExportEvidence(exportFixture).finalRevision,2);
 assert.equal(verifyBriefCommitment(challengeFixture,TEST_BRIEF),true);
});
test('rejects unknown and duplicate JSON keys and unsafe ids',()=>{
 assert.throws(()=>validateChallenge({...challengeFixture,extraKey:'bad'}),/unknown field/);
 assert.throws(()=>validateChallenge({...challengeFixture,sessionId:'../break'}),/sessionId/);
 const dup=JSON.stringify(challengeFixture).replace('"sessionId":"test-run-001"','"sessionId":"test-run-001","sessionId":"shadow"');
 assert.throws(()=>validateChallenge(dup),/duplicate JSON/);
});
test('rejects nonce, timestamps, source sha and brief byte mismatch',()=>{
 assert.throws(()=>validateChallenge({...challengeFixture,nonce:'x'}),/nonce/);
 assert.throws(()=>validateChallenge({...challengeFixture,projectSha:'not-a-sha'}),/projectSha/);
 assert.throws(()=>validateChallenge({...challengeFixture,challengeCommitmentAt:'2026-10-11'}),/challengeCommitmentAt/);
 assert.throws(()=>verifyBriefCommitment(challengeFixture,Buffer.from(TEST_BRIEF.toString().replace('\r\n','\n'))),/challengeDigest/);
});
test('rejects invalid budgets and unauthorized tools',()=>{
 assert.throws(()=>validateChallenge({...challengeFixture,toolCallBudget:51}),/toolCallBudget/);
 assert.throws(()=>validateChallenge({...challengeFixture,allowedToolNames:['shell_exec']}),/allowedToolNames/);
 assert.throws(()=>validateChallenge({...challengeFixture,allowedToolNames:['render_preview','render_preview']}),/duplicate/);
});
test('rejects wrong producer, event kind, unsupported evidence types',()=>{
 assert.throws(()=>validateInvocationEvent({...eventFixture,producer:'ATTACKER'}),/producer/);
 assert.throws(()=>validateInvocationEvent({...eventFixture,eventKind:'MODEL_SIGNED_BY_GITHUB'}),/eventKind/);
 assert.throws(()=>validateInvocationEvent({...eventFixture,evidenceKind:'HUMAN_REVIEW'}),/evidenceKind/);
 assert.throws(()=>validateInvocationEvent({...eventFixture,eventSequence:-1}),/eventSequence/);
});
test('enforces export revision and sha lineage',()=>{
 assert.throws(()=>validateExportEvidence({...exportFixture,finalRevision:1}),/revision/);
 assert.throws(()=>validateExportEvidence({...exportFixture,exportAssetSha256:'bad'}),/exportAssetSha256/);
});
