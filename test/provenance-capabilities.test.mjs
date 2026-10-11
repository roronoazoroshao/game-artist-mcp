import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHostCapabilities } from '../src/provenance/host-capabilities.mjs';

const fakeEvidence = [
  { kind: 'OPENAI_CALL_ID', documentationUrl: 'https://developers.openai.com/api/docs/guides/function-calling' },
  { kind: 'GITHUB_BUILD_ATTESTATION', documentationUrl: 'https://docs.github.com/en/actions/concepts/security/artifact-attestations' },
  { kind: 'SELF_SIGNED_TRANSCRIPT', documentationUrl: 'https://example.com/self-signed' },
];

test('rejects call_id, CI attestation and self-signed transcript as model attestation', () => {
  for (const mechanism of fakeEvidence) {
    const report = assessHostCapabilities({ documentedMechanisms: [mechanism], availableTools: ['render_preview'] });
    assert.equal(report.strictProviderGate, 'BLOCKED');
    assert.equal(report.providerReceiptSupported, false);
    assert.equal(report.hostReceiptSupported, false);
    assert.equal(report.imageDispatchObserved, false);
    assert.ok(report.reasons.includes('PROVIDER_ATTESTATION_UNAVAILABLE'));
  }
});

test('rejects self-declared signing, forged attestations and synthetic claims', () => {
  const report = assessHostCapabilities({
    documentedMechanisms: [{ kind: 'PROVIDER_SIGNED_RECEIPT', providerReceiptSupported: true, issuerIndependent: true, signatureVerified: true, evidenceKind: 'SYNTHETIC_TEST' }],
    availableTools: ['provider_sign', 'model_image_delivered'],
  });
  assert.equal(report.strictProviderGate, 'BLOCKED');
  assert.equal(report.providerReceiptSupported, false);
  assert.equal(report.imageDispatchObserved, false);
});

test('fails closed with malformed capability data', () => {
  assert.throws(() => assessHostCapabilities({ documentedMechanisms: {}, availableTools: [] }), /documentedMechanisms/);
  assert.throws(() => assessHostCapabilities({ documentedMechanisms: [], availableTools: ['ok', 123] }), /availableTools/);
  assert.throws(() => assessHostCapabilities({ documentedMechanisms: [{ kind: 99 }], availableTools: [] }), /kind/);
});

test('has non-secret, bounded and stable negative report', () => {
  const one = assessHostCapabilities({documentedMechanisms: fakeEvidence, availableTools: []});
  const two = assessHostCapabilities({documentedMechanisms: fakeEvidence, availableTools: []});
  assert.deepEqual(one,two);
  assert.deepEqual(one.evidenceRefs, [
    'https://developers.openai.com/api/docs/guides/function-calling',
    'https://docs.github.com/en/actions/concepts/security/artifact-attestations',
  ]);
  assert.ok(JSON.stringify(one).length < 3000);
});
