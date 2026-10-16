import {validateArtBrief,validateRasterPackage,assertSafeLayerPath} from './contracts.mjs';
import {inspectAiPng} from './png-intake.mjs';
import {verifyProvenanceEvents,digestProvenanceEvents} from './provenance.mjs';

const fail=reason=>{throw Error('R9A_INTAKE_REJECTED: '+reason)};
/**
 * Validate staged, in-memory, provider-created raster layers without opening
 * files based on untrusted manifest strings. The future R9b staging resolver
 * is responsible for canonical workspace paths, symlink handling and masks.
 */
export function validateAiRasterIntake({brief,pkg,layers,operations}={}){
 validateArtBrief(brief);
 validateRasterPackage(pkg);
 if(pkg.assetId!==brief.assetId||
 pkg.masterCanvas.width!==brief.masterCanvas.width||
 pkg.masterCanvas.height!==brief.masterCanvas.height||
 pkg.runtimeCanvas.width!==brief.runtimeCanvas.width||
 pkg.runtimeCanvas.height!==brief.runtimeCanvas.height||
 JSON.stringify(pkg.parts)!==JSON.stringify(brief.requiredParts)||
 JSON.stringify(pkg.poseIds)!==JSON.stringify(brief.poseIds))fail('brief and package mismatch');
 if(!(layers instanceof Map))fail('expected trusted in-memory layer Map');
 const verified=verifyProvenanceEvents(operations);
 if(pkg.operationsAuditSha256!==digestProvenanceEvents(operations))fail('model operations audit SHA mismatch');
 const accepted=new Set();
 for(const op of operations){
  if(!brief.allowedProviders.includes(op.provider))fail('provider not in approved brief');
  if(op.accepted)accepted.add(op.targetPart+'/'+op.outputSha256);
 }
 const expected=new Set(pkg.layers.map(l=>l.path));
 if(layers.size!==expected.size)fail('missing or surplus layer files');
 for(const key of layers.keys()){
  assertSafeLayerPath(key);
  if(!expected.has(key))fail('unlisted image input');
 }
 const partCounts=new Map(),poseCounts=new Set();
 for(const layer of pkg.layers){
  const bytes=layers.get(layer.path);
  if(!Buffer.isBuffer(bytes))fail('missing image input '+layer.path);
  const info=inspectAiPng(bytes);
  if(info.width!==layer.width||info.height!==layer.height||
 info.sourceSha256!==layer.sourceSha256)fail('layer checksum or dimensions mismatch');
  if(layer.maskSha256!==null)fail('unverified external masks require R9b mask bytes');
  if(!accepted.has(layer.partId+'/'+layer.sourceSha256))fail('no accepted output lineage for '+layer.layerId);
  partCounts.set(layer.partId,(partCounts.get(layer.partId)??0)+1);
  if(layer.poseId!==null)poseCounts.add(layer.poseId);
 }
 if(brief.requiredParts.some(part=>!partCounts.has(part))||
 brief.poseIds.some(pose=>!poseCounts.has(pose)))fail('incomplete rig part/pose coverage');
 const rightsReviewed=pkg.rightsDecision==='COMMERCIAL_REVIEWED';
 return Object.freeze({
  ok:true,
  status:rightsReviewed?'INTAKE_VERIFIED':'INTAKE_VERIFIED_RIGHTS_PENDING',
  exportAllowed:rightsReviewed,
  layerCount:pkg.layers.length,
  operationsCount:verified.count,
  provenanceHeadSha256:verified.headSha256
 });
}
