import {createHash} from 'node:crypto';

const ID=/^[a-z][a-z0-9_]{0,63}$/;
const SHA=/^[0-9a-f]{64}$/;
const PARTS=new Set(['body','flame','talisman_left','talisman_right','tassel']);
const fail=message=>{throw Error('R9A_INVALID_PROVENANCE: '+message)};
const validSha=x=>typeof x==='string'&&SHA.test(x);
const validNullableSha=x=>x===null||validSha(x);
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object'){
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)fail('non-plain event');
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 }
 if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return JSON.stringify(value);
 fail('unsupported value or undefined');
}
const hash=x=>createHash('sha256').update(x).digest('hex');
const KEYS=['operationId','provider','modelId','targetPart','promptSha256','inputSha256','maskSha256','outputSha256','accepted'];
function validateBare(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||
 Object.keys(event).sort().join('|')!==KEYS.slice().sort().join('|'))fail('unexpected event fields');
 if(!ID.test(event.operationId)||!ID.test(event.provider)||!ID.test(event.modelId)||
 !PARTS.has(event.targetPart))fail('event identity');
 if(!validSha(event.promptSha256)||!validNullableSha(event.inputSha256)||
 !validNullableSha(event.maskSha256)||!validSha(event.outputSha256)||typeof event.accepted!=='boolean')fail('event hash/decision');
}
export function makeProvenanceEvent(event,prevSha256=null){
 validateBare(event);
 if(!validNullableSha(prevSha256))fail('invalid previous digest');
 const plain={...event,prevSha256};
 return Object.freeze({...plain,eventSha256:hash(canonical(plain))});
}
export function digestProvenanceEvents(events){
 if(!Array.isArray(events)||events.length>256)fail('bounded event sequence required');
 return hash(events.map(e=>canonical(e)+'\n').join(''));
}
export function verifyProvenanceEvents(events){
 if(!Array.isArray(events)||events.length<1||events.length>256)fail('one to 256 model operations required');
 const ids=new Set();let expectedPrevious=null;
 for(const [index,event] of events.entries()){
  if(!event||typeof event!=='object'||Array.isArray(event))fail('invalid operation at '+index);
  const {prevSha256,eventSha256,...bare}=event;
  validateBare(bare);
  if(Object.keys(event).length!==KEYS.length+2)fail('unexpected event fields');
  if(!validSha(eventSha256)||prevSha256!==expectedPrevious)fail('broken hash chain at '+index);
  if(ids.has(bare.operationId))fail('duplicate operation ID');
  ids.add(bare.operationId);
  const recomputed=makeProvenanceEvent(bare,prevSha256);
  if(recomputed.eventSha256!==eventSha256)fail('tampered operation at '+index);
  expectedPrevious=eventSha256;
 }
 return Object.freeze({ok:true,headSha256:expectedPrevious,count:events.length});
}
