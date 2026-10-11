const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/,NONCE=/^[a-f0-9]{32,128}$/,ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const REQUIRED=['schemaVersion','issuerRef','receiptFormat','publicVerificationRoot','trustedCustodianRef','expectedProducer','sessionId','nonce','challengeDigest','projectSha','modelIdentifier'];
export function validateTrustPolicy(policy){
 if(!policy||typeof policy!=='object'||Array.isArray(policy))throw Error('policy must be verifier-owned object');
 for(const key of Object.keys(policy))if(!REQUIRED.includes(key))throw Error('unknown field '+key);
 for(const key of REQUIRED)if(!Object.hasOwn(policy,key))throw Error('missing policy field '+key);
 if(policy.schemaVersion!==1)throw Error('schemaVersion unsupported');
 for(const key of ['issuerRef','receiptFormat','trustedCustodianRef','sessionId','modelIdentifier'])if(typeof policy[key]!=='string'||!ID.test(policy[key]))throw Error(key+' invalid');
 if(typeof policy.publicVerificationRoot!=='string'||policy.publicVerificationRoot.length>2048||!policy.publicVerificationRoot)throw Error('publicVerificationRoot invalid');
 if(!['PROVIDER','HOST'].includes(policy.expectedProducer))throw Error('expectedProducer invalid');
 if(!NONCE.test(policy.nonce))throw Error('nonce invalid');
 if(!SHA64.test(policy.challengeDigest)||!SHA40.test(policy.projectSha))throw Error('challengeDigest / projectSha invalid');
 // A validated policy does not attest independent custody or identity.
 return structuredClone(policy);
}
