const fail=reason=>{throw Error('R9D_REGISTRY_REJECTED: '+reason)};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL=/^https:\/\/photoshop-api\.adobe\.io\/v2\/short-url\/urn:aaid:ps:US:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAMES=['body','flame_a','flame_b','flame_c','flame_d','talisman_left','talisman_right','tassel'];
const sub=o=>o&&typeof o==='object'&&!Array.isArray(o);

/**
 * Audit only provider reference records which have *no image bytes* yet.
 * Passing this is not a valid source/art/rights approval. Full PNG bytes must
 * pass r9d-paint-intake.mjs and the 4 real flames must pass the pose gate.
 */
export function auditR9dPartRegistry(doc){
 if(!sub(doc)||doc.schemaVersion!==1||doc.assetId!=='spirit_lantern'||
    doc.manifestKind!=='ADOBE_GENERATED_PAINT_CANDIDATE_REQUEST_LOG'||
    doc.candidateSet!=='r9d_parts_set_001'||doc.provider!=='Adobe Firefly'||
    doc.componentCount!==8||doc.rigPartCount!==5||doc.flamePoseCount!==4||
    !Array.isArray(doc.operations)||doc.operations.length!==8)
  fail('incorrect candidate registry, asset or part count');
 const gen=new Set(),cut=new Set();
 const names=[];
 for(const op of doc.operations){
  if(!sub(op)||!NAMES.includes(op.partId)||
     !UUID.test(op.generationRequestId??'')||!UUID.test(op.cutoutRequestId??'')||
     !URL.test(op.generationOutputUrl??'')||!URL.test(op.cutoutOutputUrl??'')||
     gen.has(op.generationRequestId)||cut.has(op.cutoutRequestId)||
     op.cutoutMimeType!=='image/png'||
     op.sourcePngStored!==false||op.sourcePngSha256!==null||
     op.sourcePngByteInspected!==false||op.rigPlacementVerified!==false||
     op.commercialRightsCleared!==false||op.artisticReview!=='UNSCORED'||
     op.exportAllowed!==false||op.sourceStatus!=='PROVIDER_URL_ONLY'||
     !sub(op.outputCanvas)||!Number.isSafeInteger(op.outputCanvas.width)||
     !Number.isSafeInteger(op.outputCanvas.height)||
     op.outputCanvas.width<64||op.outputCanvas.height<64||
     op.outputCanvas.width*op.outputCanvas.height>4194304)
   fail('untrusted asset reference, already-claimed source or forged rights/rig status');
  gen.add(op.generationRequestId);
  cut.add(op.cutoutRequestId);
  names.push(op.partId);
 }
 if(names.some((name,i)=>name!==NAMES[i]))
  fail('canonical sprite owner/pose ids not in expected order');
 const review=doc.visualReview,publication=doc.publication;
 if(!sub(review)||!sub(publication)||
    review.flamePoseGate!=='SOURCE_PNG_BYTES_PENDING'||
    review.status!=='CANDIDATES_VISUALLY_SCREENED_NOT_QA_APPROVED'||
    review.noOriginalPngOrRigClaims!==true||
    publication.paintedByAI!==true||
    publication.editableRigLayers!==false||
    publication.sourceBytesArchived!==false||
    publication.commercialRightsVerified!==false||
    publication.exportAllowed!==false||
    publication.artisticGO!==false)
   fail('premature visual or release approval claims');
 if(!Array.isArray(doc.flameRevisionHistory)||doc.flameRevisionHistory.length!==3||
    doc.flameRevisionHistory.map(op=>op.partId).join('/')!=='flame_b/flame_c/flame_d'||
    doc.flameRevisionHistory.some(op=>
      op.revisionStatus!=='SUPERSEDED_AFTER_VISUAL_INSPECTION_AS_NEAR_DUPLICATE'||
      gen.has(op.generationRequestId)||
      !UUID.test(op.generationRequestId??'')))
   fail('earlier rejected flame candidates must remain in audit history');
 return Object.freeze({
  ok:true,status:'SOURCE_BYTES_NOT_ARCHIVED',assetId:doc.assetId,
  parts:Object.freeze([...NAMES]),candidateCount:NAMES.length,
  sourcesArchived:0,flamePosePixelDiversity:'NOT_RUN',
  visualQuality:'UNSCORED',rigAligned:false,exportAllowed:false
 });
}
