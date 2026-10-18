const fail=reason=>{throw Error('R9D_CUSTODY_REJECTED: '+reason)};
const SHA=/^[a-f0-9]{64}$/;
const IDS=['body','flame_a','flame_b','flame_c','flame_d','talisman_left','talisman_right','tassel'];
const POSES=['flame_a','flame_b','flame_c','flame_d'];
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/**
 * Immutable factual ledger for independently downloaded and SHA256-checked
 * Adobe PNG bytes. SHA proves byte identity, NOT Adobe provider signature,
 * independent art quality, rig correctness or commercial licensing.
 */
export function createR9dCustodyLedger({registry,report}={}){
 if(!record(registry)||!record(report)||
    registry.assetId!=='spirit_lantern'||registry.provider!=='Adobe Firefly'||
    !Array.isArray(registry.operations)||registry.operations.length!==8||
    !Array.isArray(report.parts)||report.parts.length!==8||
    registry.operations.some((op,i)=>op.partId!==IDS[i])||
    report.sourceCustody!=='VALIDATED_RUN_ARTIFACT_NOT_GIT'||
    report.sourceAuthenticated!==false||
    report.commercialRightsCleared!==false||report.rigAligned!==false||
    report.artisticReview!=='UNSCORED'||report.exportAllowed!==false)
   fail('unexpected registry, order or false source/release attestation');
 const sources=[];
 for(let i=0;i<IDS.length;i++){
  const op=registry.operations[i],p=report.parts[i];
  if(!record(p)||!record(op)||p.id!==IDS[i]||!SHA.test(p.sha256??'')||
     !Number.isSafeInteger(p.bytes)||p.bytes<64||p.bytes>4194304||
     !Array.isArray(p.canvas)||p.canvas.length!==2||
     p.canvas[0]!==op.outputCanvas?.width||
     p.canvas[1]!==op.outputCanvas?.height||
     !Number.isSafeInteger(p.transparentPixels)||p.transparentPixels<1||
     !Number.isSafeInteger(p.partialAlphaPixels)||p.partialAlphaPixels<0||
     p.byteInspected!==true||
     op.commercialRightsCleared!==false||op.sourcePngStored!==false||
     op.sourcePngSha256!==null||op.rigPlacementVerified!==false)
   fail('part source hash, canvas or proven source bytes mismatch');
  sources.push(Object.freeze({
   partId:p.id,path:'examples/spirit-lantern/r9d/parts/sources/'+p.id+'.png',
   sha256:p.sha256,bytes:p.bytes,
   canvas:Object.freeze([...p.canvas]),cutoutRequestId:op.cutoutRequestId,
   providerSourceUrl:op.cutoutOutputUrl,
   verifiedPngRgba:true,rigAligned:false,rightsVerified:false
  }));
 }
 const diversity=report.flamePoseDiversity;
 if(!record(diversity)||diversity.status!=='TECHNICAL_POSE_VARIANCE_ONLY'||
    !Array.isArray(diversity.adjacentDifferences)||
    diversity.adjacentDifferences.length!==4||
    diversity.adjacentDifferences.some((v,i)=>!record(v)||
      v.from!==POSES[i]||v.to!==POSES[(i+1)%4]||
      !Number.isFinite(v.distance)||v.distance<0.05||v.distance>1))
    fail('actual four-frame flame silhouette evidence missing or insufficient');
 return Object.freeze({
  schemaVersion:1,assetId:'spirit_lantern',provider:'Adobe Firefly',
  storeKind:'GIT_TRACKED_SOURCE_PNG',sourceAuthentication:'PROVIDER_URL_UNATTESTED',
  sources:Object.freeze(sources),sourceCount:8,
  flamePoseDiversity:Object.freeze(diversity.adjacentDifferences.map(x=>
   Object.freeze({from:x.from,to:x.to,distance:x.distance}))),
  rightsVerified:false,rigAligned:false,artisticReview:'UNSCORED',
  exportAllowed:false,productionReady:false
 });
}
