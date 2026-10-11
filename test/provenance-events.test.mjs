import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEventChain,computeEventDigest} from '../src/provenance/event-audit.mjs';
import {challengeFixture,eventFixture} from './fixtures/provenance-fixtures.mjs';
const sha=(c)=>c.repeat(64);
function make(events){let prev=null;return events.map((fields,i)=>{const e={...eventFixture,...fields,eventSequence:i,prevEventDigest:prev,eventDigest:sha('0')};e.eventDigest=computeEventDigest(e);prev=e.eventDigest;return e;});}
const chain=()=>make([
 {eventKind:'CHALLENGE_DELIVERED'},
 {eventKind:'MODEL_TOOL_DECISION',producer:'PROVIDER',toolCallId:'call1',toolName:'render_preview',argumentDigest:sha('1'),sourceKind:'AGENT_DECISION'},
 {eventKind:'TOOL_DISPATCH',producer:'HOST',toolCallId:'call1',toolName:'render_preview',argumentDigest:sha('1')},
 {eventKind:'TOOL_RESULT',producer:'MCP',toolCallId:'call1',toolName:'render_preview',resultDigest:sha('2'),imageSha256:sha('3'),responseFormat:'image/png',success:true,assetRevision:1},
 {eventKind:'MODEL_IMAGE_DELIVERED',producer:'HOST',imageSha256:sha('3'),responseFormat:'image/png'},
 {eventKind:'MODEL_CRITIQUE',producer:'HOST',imageSha256:sha('3'),critiqueDigest:sha('4')},
 {eventKind:'RUN_FINISHED',producer:'HOST'},
]);
test('valid synthetic chain has correct image/call counters, never provenance claims',()=>{
 const r=auditEventChain({challenge:challengeFixture,events:chain()});assert.equal(r.ok,true,JSON.stringify(r.errors));
 assert.equal(r.toolCalls,1);assert.equal(r.renderCount,1);assert.equal(r.imagesDelivered,1);assert.equal(r.correctionRounds,1);
});
test('rejects missing challenge before decision and reordering',()=>{
 assert.equal(auditEventChain({challenge:challengeFixture,events:make(chain().slice(1))}).ok,false);
 assert.equal(auditEventChain({challenge:challengeFixture,events:chain().toReversed()}).ok,false);
});
test('rejects missing dispatch and mismatched tool-call identity',()=>{
 const c=chain();assert.equal(auditEventChain({challenge:challengeFixture,events:make(c.filter(e=>e.eventKind!=='TOOL_DISPATCH'))}).ok,false);
 const s=make(c.map(e=>e.eventKind==='TOOL_RESULT'?{...e,toolCallId:'other'}:e));assert.equal(auditEventChain({challenge:challengeFixture,events:s}).ok,false);
});
test('rejects swapped PNG, preview without delivered image, critique ahead of image',()=>{
 const c=chain();
 assert.equal(auditEventChain({challenge:challengeFixture,events:make(c.map(e=>e.eventKind==='MODEL_IMAGE_DELIVERED'?{...e,imageSha256:sha('f')}:e))}).ok,false);
 assert.equal(auditEventChain({challenge:challengeFixture,events:make(c.filter(e=>e.eventKind!=='MODEL_IMAGE_DELIVERED'))}).ok,false);
 assert.equal(auditEventChain({challenge:challengeFixture,events:make([c[0],...c.slice(1,4),c[5],c[4],c[6]])}).ok,false);
});
test('rejects altered digest, nonce and duplicate event sequence',()=>{
 const c=chain();assert.equal(auditEventChain({challenge:challengeFixture,events:[...c.slice(0,2),{...c[2],toolCallId:'bad'},...c.slice(3)]}).ok,false);
 const seq=chain();seq[3].eventSequence=2;assert.equal(auditEventChain({challenge:challengeFixture,events:seq}).ok,false);
 const mismatched=make(chain().map(e=>({...e,nonce:sha('f')})));assert.equal(auditEventChain({challenge:challengeFixture,events:mismatched}).ok,false);
});

test('untrusted producer cannot forge host model-image-delivery or model tool decision',()=>{
 const valid=chain();
 for(const kind of ['MODEL_IMAGE_DELIVERED','TOOL_DISPATCH','TOOL_RESULT','MODEL_TOOL_DECISION']){
  const forged=make(valid.map(e=>e.eventKind===kind?{...e,producer:'MODEL_TEXT'}:e));
  assert.equal(auditEventChain({challenge:challengeFixture,events:forged}).ok,false,kind+' must fail producer role');
 }
});
