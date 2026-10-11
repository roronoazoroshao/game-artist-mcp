import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrustPolicy} from '../src/provenance/trust-policy.mjs';
import {verifyAttestation} from '../src/provenance/attestation-verify.mjs';
import {challengeFixture,eventFixture} from './fixtures/provenance-fixtures.mjs';
const policy={schemaVersion:1,issuerRef:'official_openai',receiptFormat:'unsupported',publicVerificationRoot:'not-available',trustedCustodianRef:'external-verifier',expectedProducer:'PROVIDER',sessionId:challengeFixture.sessionId,nonce:challengeFixture.nonce,challengeDigest:challengeFixture.challengeDigest,projectSha:challengeFixture.projectSha,modelIdentifier:eventFixture.modelIdentifier};
const capabilities={providerReceiptSupported:false,hostReceiptSupported:false,strictProviderGate:'BLOCKED'};
const receipt={evidenceKind:'SYNTHETIC_TEST',issuerRef:'official_openai',sessionId:policy.sessionId,nonce:policy.nonce,challengeDigest:policy.challengeDigest,projectSha:policy.projectSha,modelIdentifier:policy.modelIdentifier,receiptFormat:'unsupported',signature:'fake'};
test('trust policy rejects private keys and unknown extra trust fields',()=>{
 assert.equal(validateTrustPolicy(policy).issuerRef,'official_openai');
 assert.throws(()=>validateTrustPolicy({...policy,privateKey:'secret'}),/unknown field|private/);
 assert.throws(()=>validateTrustPolicy({...policy,nonce:'same'}),/nonce/);
});
test('GitHub artifact signature cannot establish model-origin provider receipt',()=>{
 const result=verifyAttestation({receipt:{...receipt,evidenceKind:'GITHUB_BUILD_ATTESTATION',receiptFormat:'sigstore'},event:eventFixture,policy,capabilities});
 assert.equal(result.verified,false);assert.equal(result.tier,'LOCAL_UNVERIFIED');
});
test('author-held signer and synthetic receipt never give live GO',()=>{
 const p={...policy,issuerRef:'author_key'};
 const result=verifyAttestation({receipt:{...receipt,issuerRef:'author_key'},event:eventFixture,policy:p,capabilities});
 assert.equal(result.verified,false);assert.equal(result.tier,'LOCAL_UNVERIFIED');
});
test('reject cross-session nonce, challenge and project replay before any trust upgrade',()=>{
 for(const field of ['nonce','sessionId','challengeDigest','projectSha']){
  const r={...receipt,[field]:'f'.repeat(field==='projectSha'?40:64)};
  const result=verifyAttestation({receipt:r,event:eventFixture,policy,capabilities});
  assert.equal(result.verified,false);assert.match(result.reason,/MISMATCH/);
 }
});
test('unsupported provider receipts fail closed without fabricated signature verifier',()=>{
 const result=verifyAttestation({receipt,event:eventFixture,policy,capabilities});
 assert.equal(result.verified,false);assert.equal(result.reason,'PROVIDER_ATTESTATION_UNAVAILABLE');
 assert.equal(verifyAttestation({receipt:null,event:eventFixture,policy,capabilities}).verified,false);
});
