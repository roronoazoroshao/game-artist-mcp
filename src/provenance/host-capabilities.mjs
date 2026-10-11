/**
 * Stage-0 capability assessment. Deliberately no positive provider adapter:
 * a signed response must be verified by a separately audited issuer-specific
 * verifier before this module may return AVAILABLE. Host/model assertions and
 * caller-controlled objects are NOT such a verifier.
 */
const OFFICIAL_REFS = new Set([
  'https://developers.openai.com/api/docs/guides/function-calling',
  'https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works',
  'https://modelcontextprotocol.io/specification/2025-11-25/server/tools',
  'https://docs.github.com/en/actions/concepts/security/artifact-attestations',
]);

export function assessHostCapabilities({ documentedMechanisms = [], availableTools = [] } = {}) {
  if (!Array.isArray(documentedMechanisms) || documentedMechanisms.length > 64) {
    throw new TypeError('documentedMechanisms must be a bounded array');
  }
  if (!Array.isArray(availableTools) || availableTools.length > 256 ||
      availableTools.some((name) => typeof name !== 'string' || name.length > 128)) {
    throw new TypeError('availableTools must be a bounded string array');
  }
  for (const item of documentedMechanisms) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.kind !== 'string' || item.kind.length > 80) {
      throw new TypeError('documentedMechanisms entry must have a bounded kind');
    }
  }
  const evidenceRefs = [...new Set(documentedMechanisms
    .map(item => item.documentationUrl)
    .filter(url => typeof url === 'string' && OFFICIAL_REFS.has(url)))].sort();
  // A tool-list name never proves tool execution or image delivery to the model.
  // Neither call_id, locally authored receipts nor GitHub build attestations
  // independently authenticate a provider-origin decision.
  return {
    providerReceiptSupported: false,
    hostReceiptSupported: false,
    imageDispatchObserved: false,
    strictProviderGate: 'BLOCKED',
    reasons: ['PROVIDER_ATTESTATION_UNAVAILABLE', 'NO_INDEPENDENT_MODEL_EVENT_RECEIPT_VERIFIER',
      'IMAGE_DELIVERY_NOT_INDEPENDENTLY_OBSERVED'],
    evidenceRefs,
  };
}
