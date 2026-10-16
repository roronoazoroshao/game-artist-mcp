import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {makeProvenanceEvent,digestProvenanceEvents} from '../src/ai-art/provenance.mjs';
import {validateLayeredSource} from '../src/ai-art/layered-source.mjs';
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

function masked(){
 const f=fixture();
 const mask=new PNG({width:2,height:2,colorType:6});
 for(let i=0;i<mask.data.length;i+=4)mask.data.set([0,0,0,255],i);
 const maskPng=PNG.sync.write(mask),maskHash=hash(maskPng),maskPngs=new Map();
 let previous=null;
 f.operations=[];
 for(let i=0;i<f.pkg.layers.length;i++){
  const layer=f.pkg.layers[i];
  const key='masks/'+layer.layerId+'.png';
  maskPngs.set(key,Buffer.from(maskPng));
  layer.maskSha256=maskHash;
  const event=makeProvenanceEvent({operationId:'op_'+String(i).padStart(4,'0'),
   provider:'adobe_firefly',modelId:'firefly_image_4',targetPart:layer.partId,
   promptSha256:f.pkg.rigManifestSha256,inputSha256:null,
   maskSha256:maskHash,outputSha256:layer.sourceSha256,accepted:true},previous);
  previous=event.eventSha256;f.operations.push(event);
 }
 f.pkg.operationsAuditSha256=digestProvenanceEvents(f.operations);
 return {brief:f.brief,pkg:f.pkg,layerPngs:f.layers,maskPngs,operations:f.operations,
  rigManifestSha256:f.pkg.rigManifestSha256};
}
const reject=s=>assert.throws(()=>validateLayeredSource(s),/R9A_|R9B_|AI_PNG_REJECTED/);
test('R9b validated source binds every original layer, mask, owner and provenance operation',()=>{
 const data=masked(),v=validateLayeredSource(data);
 assert.equal(v.ok,true);assert.equal(v.exportAllowed,false);
 assert.equal(v.layerDigests.length,9);assert.equal(v.maskDigests.length,9);
 assert.deepEqual(v.coverage.parts,parts);
 assert.deepEqual(v.coverage.poses,poses);
 assert.equal(v.masterCanvas.width,1024);
});
test('R9b rejects tampered, missing or extra mask sources and incorrect mask hashes',()=>{
 const changed=masked();changed.maskPngs.set('masks/'+changed.pkg.layers[0].layerId+'.png',Buffer.from('bad'));reject(changed);
 const missing=masked();missing.maskPngs.delete('masks/'+missing.pkg.layers[0].layerId+'.png');reject(missing);
 const extra=masked();extra.maskPngs.set('masks/unknown.png',extra.maskPngs.values().next().value);reject(extra);
 const mismatch=masked();mismatch.pkg.layers[0].maskSha256='f'.repeat(64);reject(mismatch);
});
test('R9b rejects forged ownership, missing poses, rig hash mismatch and invalid resolution',()=>{
 const swapped=masked();swapped.pkg.layers[0].partId='flame';reject(swapped);
 const lost=masked();lost.pkg.layers=lost.pkg.layers.filter(x=>x.poseId!=='flame_d');lost.layerPngs.delete('layers/flame_flame_d_paint.png');lost.maskPngs.delete('masks/flame_flame_d_paint.png');reject(lost);
 const rig=masked();rig.rigManifestSha256='b'.repeat(64);reject(rig);
 const size=masked();size.brief.masterCanvas.width=256;reject(size);
});
test('R9b fails closed for unverifiable provenance and unauthenticated commercial review',()=>{
 const noOps=masked();noOps.operations=[];reject(noOps);
 const forged=masked();forged.operations[0]={...forged.operations[0],accepted:false};reject(forged);
 const declared=masked();declared.pkg.rightsDecision='COMMERCIAL_REVIEWED';declared.pkg.rightsEvidenceRef='evidence_20261016';declared.pkg.rightsReviewer='reviewer_owner';
 assert.equal(validateLayeredSource(declared).exportAllowed,false);
});
