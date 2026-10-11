import test from 'node:test';
import assert from 'node:assert/strict';
import {auditArtWorkflow} from '../src/provenance/workflow-audit.mjs';
import {computeEventDigest} from '../src/provenance/event-audit.mjs';
import {challengeFixture,eventFixture,exportFixture} from './fixtures/provenance-fixtures.mjs';
const h=c=>c.repeat(64);
function make(events){let prev=null;return events.map((v,i)=>{const e={...eventFixture,...v,eventSequence:i,prevEventDigest:prev,eventDigest:h('0'),issuedAt:v.issuedAt??new Date(Date.parse(eventFixture.issuedAt)+i*1000).toISOString()};e.eventDigest=computeEventDigest(e);prev=e.eventDigest;return e;});}
const pair=(name,id,rev,more={})=>[
 {eventKind:'MODEL_TOOL_DECISION',producer:'PROVIDER',toolCallId:id,toolName:name,argumentDigest:h('a'),sourceKind:'AGENT_DECISION'},
 {eventKind:'TOOL_DISPATCH',producer:'HOST',toolCallId:id,toolName:name,argumentDigest:h('a')},
 {eventKind:'TOOL_RESULT',producer:'MCP',toolCallId:id,toolName:name,resultDigest:h('b'),assetId:challengeFixture.assetId,assetRevision:rev,success:true,...more}
];
export function validWorkflow(){return make([
 {eventKind:'CHALLENGE_DELIVERED'},
 ...pair('style_profile_get','style',0),...pair('asset_create','create',0),
 ...pair('document_apply_ops','ops1',1),...pair('render_preview','preview1',1,{imageSha256:exportFixture.initialPngSha256,responseFormat:'image/png'}),
 {eventKind:'MODEL_IMAGE_DELIVERED',producer:'HOST',imageSha256:exportFixture.initialPngSha256,responseFormat:'image/png'},
 {eventKind:'MODEL_CRITIQUE',producer:'HOST',imageSha256:exportFixture.initialPngSha256,critiqueDigest:h('9')},
 ...pair('document_apply_ops','ops2',2),...pair('render_preview','preview2',2,{imageSha256:exportFixture.revisedPngSha256,responseFormat:'image/png'}),
 {eventKind:'MODEL_IMAGE_DELIVERED',producer:'HOST',imageSha256:exportFixture.revisedPngSha256,responseFormat:'image/png'},
 ...pair('validate_asset','validate',2),...pair('style_validate','stylecheck',2),...pair('export_asset','export',2),
 {eventKind:'RUN_FINISHED',producer:'HOST'}
]);}
const run=(events=validWorkflow(),exports=exportFixture,challenge=challengeFixture)=>auditArtWorkflow({challenge,events,exports});
test('valid structural synthetic asset workflow remains UNDETERMINED autonomy',()=>{
 const r=run();assert.equal(r.technicalStatus,'TECHNICAL_PASS',JSON.stringify(r.reasons));assert.equal(r.status,'UNDETERMINED');
 assert.equal(r.metrics.toolCalls,9);assert.equal(r.metrics.renderCount,2);assert.equal(r.metrics.correctionRounds,1);
});
test('rejects missing style/profile, create and original ops',()=>{
 for(const name of ['style_profile_get','asset_create','document_apply_ops']){
  const es=validWorkflow();const found=es.find(e=>e.eventKind==='MODEL_TOOL_DECISION'&&e.toolName===name);
  assert.equal(run(make(es.filter(e=>e.toolCallId!==found.toolCallId))).status,'WORKFLOW_NO_GO');
 }
});
test('requires image delivery before critique/edit and second preview',()=>{
 const es=validWorkflow();assert.equal(run(make(es.filter(e=>e.eventKind!=='MODEL_IMAGE_DELIVERED'))).status,'WORKFLOW_NO_GO');
 assert.equal(run(make(es.filter(e=>e.eventKind!=='MODEL_CRITIQUE'))).status,'WORKFLOW_NO_GO');
});
test('rejects export revision mismatch and asset reset',()=>{
 assert.equal(run(validWorkflow(),{...exportFixture,exportRevision:1}).status,'WORKFLOW_NO_GO');
 const es=validWorkflow().map(e=>(e.toolCallId==='ops2'?{...e,assetId:'replaced_asset'}:e));
 assert.equal(run(make(es)).status,'WORKFLOW_NO_GO');
});
test('rejects scripted geometry, time, tool and correction budget violations',()=>{
 const es=validWorkflow().map(e=>e.toolCallId==='ops1'&&e.eventKind==='MODEL_TOOL_DECISION'?{...e,sourceKind:'SCRIPTED_FIXTURE'}:e);
 assert.equal(run(make(es)).status,'WORKFLOW_NO_GO');
 assert.equal(run(validWorkflow(),exportFixture,{...challengeFixture,toolCallBudget:8}).status,'WORKFLOW_NO_GO');
 const tooLong=validWorkflow().map((e,i)=>({...e,issuedAt:new Date(Date.parse(eventFixture.issuedAt)+i*60000).toISOString()}));
 assert.equal(run(make(tooLong)).status,'WORKFLOW_NO_GO');
});
test('no best-of-N selection, all attempts have identity and failures counted',()=>{
 const es=validWorkflow().map(e=>e.toolCallId==='ops2'&&e.eventKind==='TOOL_RESULT'?{...e,success:false}:e);
 assert.equal(run(make(es)).status,'WORKFLOW_NO_GO');
 assert.equal(run().metrics.toolCalls,9);
});

test('malformed non-array events fail closed instead of throwing',()=>{
 const r=run({hacked:true});
 assert.equal(r.status,'WORKFLOW_NO_GO');
 assert.equal(r.technicalStatus,'TECHNICAL_NO_GO');
});
test('second real preview must be dispatched to model, not duplicated first image',()=>{
 const e=validWorkflow().map(e=>e.eventKind==='MODEL_IMAGE_DELIVERED'&&e.imageSha256===exportFixture.revisedPngSha256?{...e,imageSha256:exportFixture.initialPngSha256}:e);
 assert.equal(run(make(e)).status,'WORKFLOW_NO_GO');
});
