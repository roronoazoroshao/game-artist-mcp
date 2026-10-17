import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {inspectAiPng} from './png-intake.mjs';

const {PNG}=pngjs;
const fail=reason=>{throw Error('R9D_PAINT_REJECTED: '+reason)};
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL=/^https:\/\/photoshop-api\.adobe\.io\/v2\/short-url\/urn:aaid:ps:US:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTS=new Set(['body','talisman_left','talisman_right','tassel','flame']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

/**
 * Byte-level ingestion gate for genuine Adobe cutout PNG candidates.
 * A provider URL or user-written requestId does not authenticate provenance.
 * Neither a valid PNG nor a SHA256 gives artistic, rig, or rights clearance.
 */
export function inspectR9dPaintPng({bytes,evidence,expectedSha256=null}={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
  evidence.schemaVersion!==1||!PARTS.has(evidence.partId)||
  evidence.provider!=='Adobe Firefly'||
  typeof evidence.generationRequestId!=='string'||!UUID.test(evidence.generationRequestId)||
  typeof evidence.cutoutRequestId!=='string'||!UUID.test(evidence.cutoutRequestId)||
  typeof evidence.cutoutOutputUrl!=='string'||!URL.test(evidence.cutoutOutputUrl)||
  evidence.commercialRightsCleared!==false||evidence.rigAligned!==false||
  evidence.exportAllowed!==false||evidence.artisticReview!=='UNSCORED'||
  !evidence.cutoutDimensions||typeof evidence.cutoutDimensions!=='object'||
  (expectedSha256!==null&&(!SHA.test(expectedSha256))))
   fail('unverified or malformed provider/rights candidate metadata');
 const metadata=inspectAiPng(bytes);
 if(metadata.width<64||metadata.height<64||
  metadata.width!==evidence.cutoutDimensions.width||
  metadata.height!==evidence.cutoutDimensions.height)
  fail('source PNG dimensions mismatch');
 if(expectedSha256!==null&&expectedSha256!==metadata.sourceSha256)
  fail('source PNG SHA256 mismatch');
 const img=PNG.sync.read(bytes,{checkCRC:true});
 let transparent=0,visible=0,partial=0;
 const pixelCount=metadata.width*metadata.height;
 for(let i=3;i<img.data.length;i+=4){
  const a=img.data[i];
  if(a<=4)transparent++;
  if(a>=96)visible++;
  if(a>4&&a<255)partial++;
 }
 if(transparent/pixelCount<0.02||visible/pixelCount<0.01)
  fail('PNG lacks a usable transparent cutout, or only contains empty pixels');
 return Object.freeze({
  ok:true,assetId:'spirit_lantern',partId:evidence.partId,
  status:expectedSha256===null?'CAPTURED_UNVERIFIED':'SHA_BOUND_UNATTESTED',
  sourceSha256:metadata.sourceSha256,width:metadata.width,height:metadata.height,
  transparentPixels:transparent,visiblePixels:visible,partialAlphaPixels:partial,
  alphaHasTransparency:true,
  origin:'ADOBE_FIREFLY_OUTPUT_CANDIDATE_UNATTESTED',
  providerRequestId:evidence.generationRequestId,
  rigAligned:false,artisticReview:'UNSCORED',commercialRightsCleared:false,
  exportAllowed:false
 });
}
