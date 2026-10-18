import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createR9dCustodyLedger} from '../src/ai-art/r9d-source-custody.mjs';
const registry=JSON.parse(await readFile(new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
function input(){
 const parts=registry.operations.map((op,i)=>({
  id:op.partId,sha256:(i+1).toString(16).padStart(64,'0'),
  bytes:1000+i,canvas:[op.outputCanvas.width,op.outputCanvas.height],
  transparentPixels:1000,partialAlphaPixels:12,byteInspected:true
 }));
 return {registry,report:{
  sourceCustody:'VALIDATED_RUN_ARTIFACT_NOT_GIT',sourceAuthenticated:false,
  commercialRightsCleared:false,rigAligned:false,artisticReview:'UNSCORED',exportAllowed:false,
  parts,flamePoseDiversity:{status:'TECHNICAL_POSE_VARIANCE_ONLY',
   adjacentDifferences:['flame_a','flame_b','flame_c','flame_d'].map((p,i)=>({
    from:p,to:['flame_b','flame_c','flame_d','flame_a'][i],distance:0.15
   }))}
 }};
}
test('R9d custody ledger preserves all eight exact SHA records and rejects release claims',()=>{
 const x=createR9dCustodyLedger(input());
 assert.equal(x.sources.length,8);
 assert.equal(x.sources.every(p=>/^[0-9a-f]{64}$/.test(p.sha256)),true);
 assert.equal(x.storeKind,'GIT_TRACKED_SOURCE_PNG');
 assert.equal(x.rightsVerified,false);
 assert.equal(x.rigAligned,false);
 assert.equal(x.artisticReview,'UNSCORED');
 assert.equal(x.exportAllowed,false);
});
test('R9d custody ledger rejects missing part, forged SHA, wrong geometry and false rights',()=>{
 const cases=[
  z=>z.report.parts.pop(),
  z=>z.report.parts[0].sha256='not-a-sha',
  z=>z.report.parts[2].canvas=[99,99],
  z=>z.report.commercialRightsCleared=true,
  z=>z.report.flamePoseDiversity.adjacentDifferences[2].distance=0.001,
  z=>z.report.parts[1].byteInspected=false,
  z=>z.report.sourceCustody='NOT_ESTABLISHED'
 ];
 for(const mutate of cases){
  const x=input();mutate(x);
  assert.throws(()=>createR9dCustodyLedger(x),/R9D_CUSTODY_REJECTED/);
 }
});
