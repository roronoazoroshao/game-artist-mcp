import {canonicalBytes,sha256Bytes} from '../evaluation/contracts.mjs';
import {validateChallenge,validateInvocationEvent} from './contracts.mjs';
const PREFIX=Buffer.from('GameArtist/POC005C2/event/v1\0','utf8');
export function computeEventDigest(raw){
 const {eventDigest,...without}=raw;
 return sha256Bytes(Buffer.concat([PREFIX,canonicalBytes(without)]));
}
export function auditEventChain({challenge,events}={}){
 const errors=[];let toolCalls=0,renderCount=0,imagesDelivered=0,correctionRounds=0;
 if(!Array.isArray(events)||events.length<2||events.length>400)return {ok:false,errors:['events missing or outside budget'],toolCalls,renderCount,imagesDelivered,correctionRounds,eventsDigest:sha256Bytes(Buffer.from(''))};
 let manifest;
 try{manifest=validateChallenge(challenge);}catch{errors.push('challenge contract invalid');}
 let prev=null,pending=null,finished=false,delivered=new Set(),rendered=new Set(),started=false;
 for(let i=0;i<events.length;i++){
  let e;
  try{e=validateInvocationEvent(events[i]);}catch{errors.push('event contract invalid at index '+i);continue;}
  if(manifest&&(e.sessionId!==manifest.sessionId||e.nonce!==manifest.nonce||e.challengeDigest!==manifest.challengeDigest))errors.push('event challenge binding mismatch at index '+i);
  if(e.eventSequence!==i)errors.push('eventSequence mismatch at index '+i);
  if(e.prevEventDigest!==prev)errors.push('prevEventDigest mismatch at index '+i);
  if(e.eventDigest!==computeEventDigest(e))errors.push('eventDigest mismatch at index '+i);
  prev=e.eventDigest;
  if(finished){errors.push('trailing event after RUN_FINISHED');continue;}
  switch(e.eventKind){
   case 'CHALLENGE_DELIVERED':
    if(i!==0||started)errors.push('CHALLENGE_DELIVERED must be first');started=true;break;
   case 'MODEL_TOOL_DECISION':
    if(!started||pending)errors.push('decision before challenge or pending dispatch');
    if(manifest&&!manifest.allowedToolNames.includes(e.toolName))errors.push('tool decision not allowed');
    pending={id:e.toolCallId,name:e.toolName,args:e.argumentDigest,stage:'decision'};toolCalls++;break;
   case 'TOOL_DISPATCH':
    if(!pending||pending.stage!=='decision'||e.toolCallId!==pending.id||e.toolName!==pending.name||e.argumentDigest!==pending.args)errors.push('tool dispatch not paired to decision');
    else pending.stage='dispatched';break;
   case 'TOOL_RESULT':
    if(!pending||pending.stage!=='dispatched'||e.toolCallId!==pending.id||e.toolName!==pending.name)errors.push('orphan or mismatched tool result');
    else {
     if(e.toolName==='render_preview'&&e.success===true){
      if(!e.imageSha256||e.responseFormat!=='image/png')errors.push('render result has no image/png digest');
      else {rendered.add(e.imageSha256);renderCount++;}
     }
     pending=null;
    }break;
   case 'MODEL_IMAGE_DELIVERED':
    if(!started||!rendered.has(e.imageSha256))errors.push('model image delivery not bound to prior PNG result');
    else {imagesDelivered++;delivered.add(e.imageSha256);}break;
   case 'MODEL_CRITIQUE':
    if(!started||delivered.size===0||!delivered.has(e.imageSha256)||!e.critiqueDigest)errors.push('critique before matching image delivery');
    else correctionRounds++;break;
   case 'RUN_FINISHED':
    if(!started||pending)errors.push('unfinished tool call at end');finished=true;break;
  }
 }
 if(!started)errors.push('missing initial challenge delivery');
 if(!finished)errors.push('missing RUN_FINISHED');
 if(pending)errors.push('unresolved tool dispatch');
 return {ok:errors.length===0,errors,toolCalls,renderCount,imagesDelivered,correctionRounds,
  eventsDigest:sha256Bytes(canonicalBytes(events.map(e=>e.eventDigest??null)))};
}
