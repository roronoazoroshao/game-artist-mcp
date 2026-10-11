const safe=(value)=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
export function buildProvenanceReport({challenge,capabilities,attestations=[],events=[],workflow}={}){
 const reasons=[];
 if(!challenge||!safe(challenge.challengeId)||!safe(challenge.sessionId))throw new Error('invalid challenge identity');
 if(!workflow||!['TECHNICAL_PASS','TECHNICAL_NO_GO','INCOMPLETE'].includes(workflow.technicalStatus))throw new Error('invalid workflow');
 if(!capabilities||capabilities.strictProviderGate!=='AVAILABLE')reasons.push('PROVIDER_ATTESTATION_UNAVAILABLE');
 reasons.push('AGENT_PROVENANCE_PENDING');
 // Claim strings, booleans, host logs, signatures and fixtures cannot substitute
 // independent provider verifier results. No vendor receipt adapter is installed.
 return {
  schemaVersion:1,evidenceKind:challenge.evidenceKind,challengeId:challenge.challengeId,
  sessionId:challenge.sessionId,projectSha:challenge.projectSha,
  challengeDigest:challenge.challengeDigest,
  technicalStatus:workflow.technicalStatus,workflowStatus:workflow.status,
  provenanceStatus:'UNVERIFIED',visualStatus:'VISUAL_REVIEW_PENDING',
  reasons:[...new Set([...reasons,...(workflow.reasons||[]).filter(x=>/^[A-Z_]+$/.test(x))])],
  metrics:{toolCalls:workflow.metrics?.toolCalls??0,renderCount:workflow.metrics?.renderCount??0,correctionRounds:workflow.metrics?.correctionRounds??0,elapsedMs:workflow.metrics?.elapsedMs??0},
 };
}
export function redactProvenanceReport(report){
 if(!report||typeof report!=='object')throw new Error('report is required');
 const allowed=['schemaVersion','evidenceKind','challengeId','sessionId','projectSha','challengeDigest','technicalStatus','workflowStatus','provenanceStatus','visualStatus'];
 const out={};for(const key of allowed)if(Object.hasOwn(report,key))out[key]=report[key];
 out.reasons=Array.isArray(report.reasons)?report.reasons.filter(x=>typeof x==='string'&&/^[A-Z_]+$/.test(x)).slice(0,30):[];
 const m=report.metrics??{};out.metrics={};for(const name of ['toolCalls','renderCount','correctionRounds','elapsedMs'])if(Number.isSafeInteger(m[name])&&m[name]>=0)out.metrics[name]=m[name];
 return out;
}
export function aggregateProvenanceRuns({reports=[],expectedChallengeIds=[]}={}){
 const reasons=[];
 if(!Array.isArray(reports)||!Array.isArray(expectedChallengeIds)||expectedChallengeIds.length!==3||new Set(expectedChallengeIds).size!==3)reasons.push('INVALID_FROZEN_CHALLENGE_SET');
 if(reports.length!==3)reasons.push('REQUIRES_THREE_TRIALS');
 if(new Set(reports.map(r=>r?.challengeId)).size!==reports.length)reasons.push('DUPLICATE_CHALLENGE');
 if(reports.some(r=>!expectedChallengeIds.includes(r?.challengeId)))reasons.push('UNCOMMITTED_OR_SELECTED_TRIAL');
 if(reports.some(r=>r?.evidenceKind==='SYNTHETIC_TEST'))reasons.push('SYNTHETIC_EVIDENCE_EXCLUDED');
 if(reports.some(r=>r?.provenanceStatus!=='PROVIDER_ATTESTED'||r?.technicalStatus!=='TECHNICAL_PASS'||r?.workflowStatus!=='AGENT_AUTHORED'))reasons.push('PROVIDER_ATTESTATION_UNAVAILABLE');
 // No provider receipt validator is available. Never compute GO from JSON flags.
 reasons.push('NO_INDEPENDENT_PROVIDER_VERIFIER');
 return {strictProviderGo:false,reasons:[...new Set(reasons)],trialCount:reports.length};
}
