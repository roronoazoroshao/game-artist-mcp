import {createHash} from 'node:crypto';
import {validateArtBrief,validateRasterPackage,assertSafeLayerPath} from './contracts.mjs';
import {inspectAiPng} from './png-intake.mjs';
import {verifyProvenanceEvents,digestProvenanceEvents} from './provenance.mjs';

const fail=reason=>{throw Error('R9B_SOURCE_REJECTED: '+reason)};
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const MASK_PATH=/^masks\/[a-z][a-z0-9_]{0,63}\.png$/;
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const SAME=(a,b)=>a.length===b.length&&a.every((item,i)=>item===b[i]);
const PARTS=['body','flame','talisman_left','talisman_right','tassel'];
const POSES=['flame_a','flame_b','flame_c','flame_d'];

/**
 * Strict in-memory bridge from R9a checked source bytes to an editable R9b
 * package. These hashes prove byte consistency, NOT provider authenticity.
 * Permission to release remains explicitly denied.
 */
export function validateLayeredSource({
 brief,pkg,layerPngs,maskPngs,operations,rigManifestSha256
}={}){
 validateArtBrief(brief);
 validateRasterPackage(pkg);
 if(!(layerPngs instanceof Map)||!(maskPngs instanceof Map)||
 !Array.isArray(operations))fail('in-memory PNG maps and audit required');
 if(rigManifestSha256!==pkg.rigManifestSha256||
 pkg.assetId!==brief.assetId||
 pkg.masterCanvas.width!==brief.masterCanvas.width||
 pkg.masterCanvas.height!==brief.masterCanvas.height||
 pkg.runtimeCanvas.width!==brief.runtimeCanvas.width||
 pkg.runtimeCanvas.height!==brief.runtimeCanvas.height||
 !SAME(pkg.parts,brief.requiredParts)||!SAME(pkg.poseIds,brief.poseIds))
  fail('brief, rig or canvas mismatch');
 verifyProvenanceEvents(operations);
 if(digestProvenanceEvents(operations)!==pkg.operationsAuditSha256)
  fail('operation-chain digest mismatch');
 const accepted=new Set();
 for(const operation of operations){
  if(!brief.allowedProviders.includes(operation.provider))fail('provider outside brief allowlist');
  if(operation.accepted)
   accepted.add([operation.targetPart,operation.outputSha256,operation.maskSha256??''].join('/'));
 }
 const declared=new Set(pkg.layers.map(l=>l.path));
 if(layerPngs.size!==declared.size)fail('missing/surplus layer bytes');
 for(const name of layerPngs.keys()){
  assertSafeLayerPath(name);
  if(!declared.has(name))fail('unlisted layer path');
 }
 const requiredMasks=new Set(pkg.layers.filter(l=>l.maskSha256!==null)
  .map(l=>'masks/'+l.layerId+'.png'));
 if(maskPngs.size!==requiredMasks.size)fail('missing/surplus masks');
 for(const name of maskPngs.keys()){
  if(typeof name!=='string'||!MASK_PATH.test(name)||!requiredMasks.has(name))
   fail('unlisted/unsafe mask path');
 }
 let decoded=0;
 const layerDigests=[],maskDigests=[],layers=[],partCoverage=new Set(),poseCoverage=new Set();
 for(const layer of pkg.layers){
  const png=layerPngs.get(layer.path);
  if(!Buffer.isBuffer(png))fail('missing source buffer');
  const inspected=inspectAiPng(png);
  if(inspected.sourceSha256!==layer.sourceSha256||
     inspected.width!==layer.width||inspected.height!==layer.height)
   fail('source SHA256/dimensions mismatch');
  decoded+=inspected.width*inspected.height*4;
  let maskPng=null,maskPath=null;
  if(layer.maskSha256!==null){
   maskPath='masks/'+layer.layerId+'.png';
   maskPng=maskPngs.get(maskPath);
   if(!Buffer.isBuffer(maskPng))fail('missing mask buffer');
   const maskInfo=inspectAiPng(maskPng);
   if(maskInfo.width!==inspected.width||maskInfo.height!==inspected.height||
      maskInfo.sourceSha256!==layer.maskSha256)fail('mask SHA256/dimensions mismatch');
   decoded+=maskInfo.width*maskInfo.height*4;
   maskDigests.push(Object.freeze({layerId:layer.layerId,path:maskPath,sha256:layer.maskSha256}));
  }
  if(decoded>64*1024*1024)fail('aggregate decoded source and mask budget');
  if(!accepted.has([layer.partId,layer.sourceSha256,layer.maskSha256??''].join('/')))
   fail('no accepted provider-operation lineage for part, layer and mask');
  partCoverage.add(layer.partId);
  if(layer.poseId!==null)poseCoverage.add(layer.poseId);
  layerDigests.push(Object.freeze({layerId:layer.layerId,path:layer.path,sha256:layer.sourceSha256}));
  layers.push(Object.freeze({...layer,png:Buffer.from(png),
   maskPng:maskPng===null?null:Buffer.from(maskPng),maskPath}));
 }
 if(!SAME(PARTS,[...PARTS].filter(x=>partCoverage.has(x)))||
    !SAME(POSES,[...POSES].filter(x=>poseCoverage.has(x))))
  fail('missing required rig parts or flame poses');
 return Object.freeze({
  ok:true,exportAllowed:false,rightsStatus:pkg.rightsDecision,
  masterCanvas:Object.freeze({...pkg.masterCanvas}),
  runtimeCanvas:Object.freeze({...pkg.runtimeCanvas}),
  assetId:pkg.assetId,rigManifestSha256,
  operationsAuditSha256:pkg.operationsAuditSha256,
  layerDigests:Object.freeze(layerDigests),maskDigests:Object.freeze(maskDigests),
  coverage:Object.freeze({parts:Object.freeze([...PARTS]),poses:Object.freeze([...POSES])}),
  layers:Object.freeze(layers)
 });
}
