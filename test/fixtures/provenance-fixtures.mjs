import {sha256Bytes} from '../../src/evaluation/contracts.mjs';
export const TEST_BRIEF = Buffer.from('An original moonseed compass, painted with explicit paths.\r\n','utf8');
export const challengeFixture = Object.freeze({
 schemaVersion:1,evidenceKind:'SYNTHETIC_TEST',sessionId:'test-run-001',nonce:'0123456789abcdef0123456789abcdef',
 challengeId:'challenge-one',assetId:'moonseed_compass',challengeDigest:sha256Bytes(TEST_BRIEF),
 challengeCommitmentAt:'2026-10-11T01:00:00Z',projectSha:'a'.repeat(40),styleProfileId:'cultivation-style-v1',
 mcpServerVersion:'0.0.3',rendererVersion:'2.58.0',allowedToolNames:['style_profile_get','asset_create','document_apply_ops','render_preview','validate_asset','style_validate','export_asset'],
 policyDigest:'b'.repeat(64),timeBudgetSeconds:900,toolCallBudget:50,correctionBudget:5,
 holdoutCustodianRef:'custodian1',hostIdentityPolicy:'strict-provider',provenanceRequirement:'PROVIDER_ATTESTED'
});
export const eventFixture=Object.freeze({
 schemaVersion:1,evidenceKind:'SYNTHETIC_TEST',sessionId:challengeFixture.sessionId,nonce:challengeFixture.nonce,challengeDigest:challengeFixture.challengeDigest,
 producer:'HOST',eventKind:'CHALLENGE_DELIVERED',eventSequence:0,issuedAt:'2026-10-11T01:00:01Z',modelProvider:'openai',modelIdentifier:'test-model',modelInvocationId:'inv-1',hostRunId:'host-1',
 prevEventDigest:null,eventDigest:'c'.repeat(64),attestationTier:'LOCAL_UNVERIFIED'
});
export const exportFixture=Object.freeze({
 schemaVersion:1,evidenceKind:'SYNTHETIC_TEST',runId:'run-one',challengeDigest:challengeFixture.challengeDigest,sourceCommitSha:challengeFixture.projectSha,
 initialPngSha256:'1'.repeat(64),revisedPngSha256:'2'.repeat(64),initialSvgSha256:'3'.repeat(64),revisedSvgSha256:'4'.repeat(64),
 initialMcpPngSha256:'1'.repeat(64),revisedMcpPngSha256:'2'.repeat(64),finalDocumentSha256:'5'.repeat(64),exportAssetSha256:'6'.repeat(64),
 initialRevision:1,finalRevision:2,exportRevision:2,assetId:challengeFixture.assetId
});
