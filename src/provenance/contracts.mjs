import {parseEvaluationJson,sha256Bytes} from '../evaluation/contracts.mjs';

const SHA=/^[0-9a-f]{64}$/;
const SHA40=/^[0-9a-f]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const NONCE=/^[0-9a-f]{32,128}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(ok,message)=>{if(!ok)throw new Error(message);};
const parse=(input)=>typeof input==='string'?parseEvaluationJson(input):input;
function exactKeys(obj,required,optional=[]){
 fail(isObject(obj),'expected object');const valid=new Set([...required,...optional]);
 for(const key of Object.keys(obj))fail(valid.has(key),'unknown field '+key);
 for(const key of required)fail(Object.hasOwn(obj,key),'missing '+key);
}
function id(v,name){fail(typeof v==='string'&&ID.test(v),name+' invalid id');}
function digest(v,name,len=64){fail(typeof v==='string'&&(len===40?SHA40:SHA).test(v),name+' invalid SHA');}
function str(v,name,max=160){fail(typeof v==='string'&&v.length>0&&v.length<=max,name+' invalid string');}
function utc(v,name){fail(typeof v==='string'&&UTC.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().startsWith(v.slice(0,19)),name+' invalid UTC');}
function positiveInt(v,name,max,min=1){fail(Number.isSafeInteger(v)&&v>=min&&v<=max,name+' outside budget');}
function evidence(v){fail(['SYNTHETIC_TEST','CURATOR_COMMITMENT','HOST_RECEIPT','PROVIDER_RECEIPT'].includes(v),'evidenceKind unsupported');}
function version(v){fail(v===1,'schemaVersion unsupported');}
export const ART_TOOLS=Object.freeze(['style_profile_get','asset_create','asset_get','document_query','document_apply_ops','render_preview','validate_asset','style_validate','export_asset','health','export_godot_cutout']);

export function validateChallenge(raw){
 const x=parse(raw);
 exactKeys(x,['schemaVersion','evidenceKind','sessionId','nonce','challengeId','assetId','challengeDigest','challengeCommitmentAt','projectSha','styleProfileId','mcpServerVersion','rendererVersion','allowedToolNames','policyDigest','timeBudgetSeconds','toolCallBudget','correctionBudget','holdoutCustodianRef','hostIdentityPolicy','provenanceRequirement']);
 version(x.schemaVersion);evidence(x.evidenceKind);id(x.sessionId,'sessionId');id(x.challengeId,'challengeId');id(x.assetId,'assetId');
 fail(typeof x.nonce==='string'&&NONCE.test(x.nonce),'nonce must be at least 128-bit lowercase hex');
 digest(x.challengeDigest,'challengeDigest');utc(x.challengeCommitmentAt,'challengeCommitmentAt');digest(x.projectSha,'projectSha',40);
 id(x.styleProfileId,'styleProfileId');str(x.mcpServerVersion,'mcpServerVersion');str(x.rendererVersion,'rendererVersion');
 fail(Array.isArray(x.allowedToolNames)&&x.allowedToolNames.length>0&&x.allowedToolNames.length<=ART_TOOLS.length,'allowedToolNames invalid');
 for(const name of x.allowedToolNames)fail(ART_TOOLS.includes(name),'allowedToolNames contains unsupported tool');
 fail(new Set(x.allowedToolNames).size===x.allowedToolNames.length,'duplicate allowedToolNames');
 digest(x.policyDigest,'policyDigest');positiveInt(x.timeBudgetSeconds,'timeBudgetSeconds',900);positiveInt(x.toolCallBudget,'toolCallBudget',50);
 positiveInt(x.correctionBudget,'correctionBudget',5,0);id(x.holdoutCustodianRef,'holdoutCustodianRef');id(x.hostIdentityPolicy,'hostIdentityPolicy');
 fail(['PROVIDER_ATTESTED','HOST_ATTESTED'].includes(x.provenanceRequirement),'provenanceRequirement unsupported');
 return structuredClone(x);
}

export function verifyBriefCommitment(challenge,briefBytes){
 const x=validateChallenge(challenge);
 fail(Buffer.isBuffer(briefBytes)||briefBytes instanceof Uint8Array,'briefBytes must be exact bytes');
 fail(briefBytes.length>0&&briefBytes.length<=65536,'brief byte-size budget');
 fail(sha256Bytes(briefBytes)===x.challengeDigest,'challengeDigest original brief byte mismatch');
 return true;
}

const EVENT_KINDS=Object.freeze(['CHALLENGE_DELIVERED','MODEL_TOOL_DECISION','TOOL_DISPATCH','TOOL_RESULT','MODEL_IMAGE_DELIVERED','MODEL_CRITIQUE','RUN_FINISHED']);
export function validateInvocationEvent(raw){
 const x=parse(raw);
 exactKeys(x,['schemaVersion','evidenceKind','sessionId','nonce','challengeDigest','producer','eventKind','eventSequence','issuedAt','modelProvider','modelIdentifier','modelInvocationId','hostRunId','prevEventDigest','eventDigest','attestationTier'],
  ['toolCallId','toolName','argumentDigest','resultDigest','assetRevision','imageSha256','responseFormat','attestationRef','critiqueDigest','assetId','success','sourceKind','elapsedMs']);
 version(x.schemaVersion);evidence(x.evidenceKind);id(x.sessionId,'sessionId');id(x.modelProvider,'modelProvider');id(x.modelIdentifier,'modelIdentifier');
 id(x.modelInvocationId,'modelInvocationId');id(x.hostRunId,'hostRunId');
 fail(typeof x.nonce==='string'&&NONCE.test(x.nonce),'nonce invalid');digest(x.challengeDigest,'challengeDigest');
 fail(['PROVIDER','HOST','MCP','MODEL_TEXT'].includes(x.producer),'producer invalid');
 fail(EVENT_KINDS.includes(x.eventKind),'eventKind unsupported');positiveInt(x.eventSequence,'eventSequence',10000,0);
 utc(x.issuedAt,'issuedAt');if(x.prevEventDigest!==null)digest(x.prevEventDigest,'prevEventDigest');digest(x.eventDigest,'eventDigest');
 fail(['LOCAL_UNVERIFIED','HOST_ATTESTED','PROVIDER_ATTESTED'].includes(x.attestationTier),'attestationTier invalid');
 if(x.toolCallId!==undefined)id(x.toolCallId,'toolCallId');if(x.toolName!==undefined)fail(ART_TOOLS.includes(x.toolName),'toolName unsupported');
 for(const name of ['argumentDigest','resultDigest','imageSha256','critiqueDigest'])if(x[name]!==undefined)digest(x[name],name);
 if(x.assetRevision!==undefined)positiveInt(x.assetRevision,'assetRevision',10000000,0);
 if(x.assetId!==undefined)id(x.assetId,'assetId');if(x.attestationRef!==undefined)id(x.attestationRef,'attestationRef');
 if(x.success!==undefined)fail(typeof x.success==='boolean','success must be boolean');
 if(x.elapsedMs!==undefined)positiveInt(x.elapsedMs,'elapsedMs',900000,0);
 if(x.sourceKind!==undefined)fail(['AGENT_DECISION','SCRIPTED_FIXTURE','TOOL_RUNTIME'].includes(x.sourceKind),'sourceKind unsupported');
 if(x.responseFormat!==undefined)fail(x.responseFormat==='image/png','responseFormat must be image/png');
 if(['MODEL_TOOL_DECISION','TOOL_DISPATCH','TOOL_RESULT'].includes(x.eventKind)){
  fail(x.toolCallId!==undefined&&x.toolName!==undefined,'tool call missing identity');
 }
 if(x.eventKind==='MODEL_TOOL_DECISION'||x.eventKind==='TOOL_DISPATCH')fail(x.argumentDigest!==undefined,'argumentDigest missing');
 if(x.eventKind==='TOOL_RESULT')fail(x.resultDigest!==undefined,'resultDigest missing');
 if(x.eventKind==='MODEL_IMAGE_DELIVERED')fail(x.imageSha256!==undefined&&x.responseFormat==='image/png','image delivery missing PNG digest');
 return structuredClone(x);
}

export function validateExportEvidence(raw){
 const x=parse(raw);
 exactKeys(x,['schemaVersion','evidenceKind','runId','challengeDigest','sourceCommitSha','initialPngSha256','revisedPngSha256','initialSvgSha256','revisedSvgSha256','initialMcpPngSha256','revisedMcpPngSha256','finalDocumentSha256','exportAssetSha256','initialRevision','finalRevision','exportRevision','assetId']);
 version(x.schemaVersion);evidence(x.evidenceKind);id(x.runId,'runId');id(x.assetId,'assetId');digest(x.challengeDigest,'challengeDigest');digest(x.sourceCommitSha,'sourceCommitSha',40);
 for(const key of ['initialPngSha256','revisedPngSha256','initialSvgSha256','revisedSvgSha256','initialMcpPngSha256','revisedMcpPngSha256','finalDocumentSha256','exportAssetSha256'])digest(x[key],key);
 positiveInt(x.initialRevision,'initialRevision',10000000);positiveInt(x.finalRevision,'finalRevision',10000000);positiveInt(x.exportRevision,'exportRevision',10000000);
 fail(x.finalRevision>x.initialRevision&&x.exportRevision===x.finalRevision,'export revision does not match final rendered state');
 fail(x.initialPngSha256===x.initialMcpPngSha256&&x.revisedPngSha256===x.revisedMcpPngSha256,'MCP PNG digest mismatch');
 return structuredClone(x);
}
