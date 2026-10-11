import {validateTrustPolicy} from './trust-policy.mjs';
const local=(reason)=>({verified:false,tier:'LOCAL_UNVERIFIED',reason});
/** No claim-to-trust promotion: no issuer-specific receipt format has been documented. */
export function verifyAttestation({receipt,event,policy,capabilities}={}){
 const pinned=validateTrustPolicy(policy);
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return local('MISSING_RECEIPT');
 if(!event||typeof event!=='object')return local('MISSING_EVENT');
 for(const field of ['sessionId','nonce','challengeDigest','projectSha','modelIdentifier']){
  if(receipt[field]!==pinned[field])return local('RECEIPT_'+field.toUpperCase()+'_MISMATCH');
 }
 for(const field of ['sessionId','nonce','challengeDigest','modelIdentifier']){
  if(event[field]!==pinned[field])return local('EVENT_'+field.toUpperCase()+'_MISMATCH');
 }
 if(receipt.issuerRef!==pinned.issuerRef||receipt.receiptFormat!==pinned.receiptFormat)return local('ISSUER_OR_FORMAT_MISMATCH');
 if(receipt.evidenceKind==='SYNTHETIC_TEST')return local('PROVIDER_ATTESTATION_UNAVAILABLE');
 if(receipt.evidenceKind!=='PROVIDER_RECEIPT'&&receipt.evidenceKind!=='HOST_RECEIPT')return local('UNSUPPORTED_EVIDENCE_KIND');
 if(!capabilities?.providerReceiptSupported||capabilities.strictProviderGate!=='AVAILABLE')return local('PROVIDER_ATTESTATION_UNAVAILABLE');
 // No signature verification adapter exists for current surveyed providers.
 // In particular, a caller-controlled boolean must NEVER allow trust promotion.
 return local('PROVIDER_ATTESTATION_UNAVAILABLE');
}
