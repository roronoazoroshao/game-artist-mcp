import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {makeProvenanceEvent,digestProvenanceEvents} from '../src/ai-art/provenance.mjs';
import {validateAiRasterIntake} from '../src/ai-art/intake.mjs';
const {PNG}=pngjs;
const hash=b=>createHash('sha256').update(b).digest('hex');
const parts=['body','flame','talisman_left','talisman_right','tassel'];
const poses=['flame_a','flame_b','flame_c','flame_d'];
function fixture(){
 const rigHash='a'.repeat(64);
 const brief={version:1,assetId:'spirit_lantern',masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},requiredParts:parts,poseIds:poses,styleDirection:'Original painted xianxia lantern',allowedProviders:['adobe_firefly']};
 const specs=[...parts.map(p=>[p,null]),...poses.map(p=>['flame',p])];
 const layers=new Map(),layerDefs=[],operations=[];
 let previous=null;
 for(let i=0;i<specs.length;i++){
  const [part,pose]=specs[i],name=part+(pose?'_'+pose:'')+'_paint',path='layers/'+name+'.png';
  const png=new PNG({width:2,height:2,colorType:6});
  for(let k=0;k<png.data.length;k+=4){png.data[k]=40+i;png.data[k+1]=80;png.data[k+2]=100;png.data[k+3]=255}
  const bytes=PNG.sync.write(png),value=hash(bytes);
  layers.set(path,bytes);
  layerDefs.push({layerId:name,partId:part,poseId:pose,path,width:2,height:2,sourceSha256:value,maskSha256:null,order:i,visible:true,alphaMode:'straight'});
  const event=makeProvenanceEvent({operationId:'op_'+String(i).padStart(4,'0'),provider:'adobe_firefly',modelId:'firefly_image_4',targetPart:part,promptSha256:rigHash,inputSha256:null,maskSha256:null,outputSha256:value,accepted:true},previous);
  previous=event.eventSha256;operations.push(event);
 }
 const pkg={version:1,assetId:'spirit_lantern',rigManifestSha256:rigHash,masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},parts,poseIds:poses,layers:layerDefs,operationsAuditSha256:digestProvenanceEvents(operations),rightsDecision:'RIGHTS_UNVERIFIED',rightsEvidenceRef:null,rightsReviewer:null};
 return {brief,pkg,layers,operations};
}
test('R9a stages all declared RGBA art layers only after checksums, owners and log match',()=>{
 const sample=fixture();
 const result=validateAiRasterIntake(sample);
 assert.equal(result.ok,true);
 assert.equal(result.exportAllowed,false);
 assert.equal(result.status,'INTAKE_VERIFIED_RIGHTS_PENDING');
 assert.equal(result.layerCount,9);
 const reviewed=fixture();reviewed.pkg.rightsDecision='COMMERCIAL_REVIEWED';reviewed.pkg.rightsEvidenceRef='review_20261016';reviewed.pkg.rightsReviewer='reviewer_owner';
 const ok=validateAiRasterIntake(reviewed);
 assert.equal(ok.status,'INTAKE_VERIFIED_REVIEW_DECLARED');assert.equal(ok.exportAllowed,false,'declaration alone must never authorize commercial export');
});
test('R9a rejects missing, additional, tampered or path-spoofed layer bytes',()=>{
 const missing=fixture();missing.layers.delete(missing.pkg.layers[0].path);assert.throws(()=>validateAiRasterIntake(missing),/R9A_/);
 const extra=fixture();extra.layers.set('layers/stray.png',extra.layers.values().next().value);assert.throws(()=>validateAiRasterIntake(extra),/R9A_/);
 const wrong=fixture();wrong.layers.set(wrong.pkg.layers[0].path,Buffer.alloc(42));assert.throws(()=>validateAiRasterIntake(wrong),/R9A_/);
 const swapped=fixture();swapped.pkg.layers[0].path='../outside.png';assert.throws(()=>validateAiRasterIntake(swapped),/R9A_/);
});
test('R9a refuses invented provider provenance, wrong lineage and hash mismatches',()=>{
 const badEvent=fixture();badEvent.operations[0]={...badEvent.operations[0],provider:'counterfeit_provider'};assert.throws(()=>validateAiRasterIntake(badEvent),/R9A_/);
 const wrongAudit=fixture();wrongAudit.pkg.operationsAuditSha256='f'.repeat(64);assert.throws(()=>validateAiRasterIntake(wrongAudit),/R9A_/);
 const orphan=fixture();orphan.operations=orphan.operations.slice(1);orphan.pkg.operationsAuditSha256=digestProvenanceEvents(orphan.operations);assert.throws(()=>validateAiRasterIntake(orphan),/R9A_/);
 const missingProof=fixture();missingProof.operations=missingProof.operations.slice(0,-1);missingProof.pkg.operationsAuditSha256=digestProvenanceEvents(missingProof.operations);assert.throws(()=>validateAiRasterIntake(missingProof),/R9A_/);
});
