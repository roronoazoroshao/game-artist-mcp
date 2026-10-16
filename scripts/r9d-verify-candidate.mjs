import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const fail=reason=>{throw Error('R9D_CONCEPT_REJECTED: '+reason)};
const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const EXPECTED_PATH='examples/spirit-lantern/r9d/concept/candidate-001-firefly-rendition.jpg';
const MODEL_REQUEST='eb52e735-6625-414e-bb83-bc47bb83cef7';
const exact= (a,b)=>a===b;
function dimensionsJpeg(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<2048||bytes.length>8*1024*1024||
   bytes[0]!==0xff||bytes[1]!==0xd8||
   bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9)
    fail('JPEG SOI/EOI header/size invalid');
 let i=2,width=null,height=null;
 while(i<bytes.length-2){
  if(bytes[i++]!==0xff)fail('invalid JPEG marker');
  while(bytes[i]===0xff)i++;
  const marker=bytes[i++];
  if(marker===0xda)break; // entropy-coded image data: no more segment length headers
  if(marker===0xd9)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(i+2>bytes.length-2)fail('truncated JPEG segment');
  const length=bytes.readUInt16BE(i);
  if(length<2||i+length>bytes.length-2)fail('unsafe JPEG segment boundary');
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<8||width!==null)fail('unsupported/duplicate JPEG SOF');
   height=bytes.readUInt16BE(i+3);
   width=bytes.readUInt16BE(i+5);
   if(bytes[i+2]!==8)fail('only 8-bit JPEG source allowed');
  }
  i+=length;
 }
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<512||height<512||width>4096||height>4096||
    width*height>4194304)fail('missing or unsupported JPEG dimensions');
 return {width,height};
}
/**
 * R9d evidence verifier is intentionally incapable of authorizing painted
 * rig layers or production use. Proof is limited to candidate JPG bytes and
 * a provider request claim; it cannot verify external provider license.
 */
export function verifyR9dCandidate({bytes,evidence}={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
  !exact(evidence.candidateId,'spirit_lantern_r9d_concept_001')||
  !exact(evidence.assetId,'spirit_lantern')||
  !exact(evidence.state,'ORIGINAL_AI_PAINTED_CONCEPT_RENDITION_ONLY')||
  !exact(evidence.origin,'ADOBE_FIREFLY_LIVE_GENERATION')||
  !exact(evidence.provider,'Adobe Firefly')||
  !exact(evidence.providerTool,'Adobe.image_generate')||
  !exact(evidence.providerRequestId,MODEL_REQUEST)||
  evidence.modelVersion!==null||
  evidence.artifactIsProviderOriginal!==false||
  evidence.repositoryArtifact!==EXPECTED_PATH||
  evidence.repositoryArtifactFormat!=='image/jpeg'||
  evidence.providerOriginalPngSha256!==null||
  evidence.generatedImagePreviewSha256!=='944f6b1dbf25fff8f59d19dbcf2eb2a20be7265d3976d7a91dcea911c7aac3f6'||
  evidence.editableRigLayers!==false||
  evidence.layeredSourceCanvas1024x1280!==false||
  evidence.artisticallyApproved!==false||
  evidence.commercialRightsCleared!==false||
  evidence.exportAllowed!==false||
  evidence.godotIntegrationAllowed!==false||
  evidence.previousArtReused!==false||
  evidence.rightsStatus!=='RIGHTS_UNVERIFIED'||
  evidence.artisticReview!=='UNSCORED')
  fail('non-canonical attribution, missing provider request or fraudulent release claim');
 if(!Array.isArray(evidence.conceptualParts)||
   evidence.conceptualParts.join('/')!=='body/flame/talisman_left/talisman_right/tassel')
  fail('unexpected conceptual rig identities');
 const {width,height}=dimensionsJpeg(bytes);
 if(width!==1344||height!==1728||
    evidence.verifiedJpegDimensions?.width!==1344||
    evidence.verifiedJpegDimensions?.height!==1728||
    SHA(bytes)!==evidence.generatedImagePreviewSha256)
    fail('provider preview SHA256 or exact dimensions changed');
 return Object.freeze({
  ok:true,assetId:'spirit_lantern',origin:'ADOBE_FIREFLY_LIVE_GENERATION',
  providerRequestId:MODEL_REQUEST,
  artifactKind:'JPEG_RENDITION_NOT_MASTER',actualFileType:'JPEG',
  width,height,sha256:SHA(bytes),paintedByAI:true,
  editableRigLayers:false,commercialRightsCleared:false,
  exportAllowed:false,artisticReview:'UNSCORED',
  warning:'Adobe-generated concept JPEG preview only; NOT an authenticated original PNG or game rig.'
 });
}
if(process.argv[1]?.endsWith('r9d-verify-candidate.mjs')){
 const evidence=JSON.parse(await readFile(new URL('../examples/spirit-lantern/r9d/concept/candidate-001-evidence.json',import.meta.url),'utf8'));
 const bytes=await readFile(new URL('../examples/spirit-lantern/r9d/concept/candidate-001-firefly-rendition.jpg',import.meta.url));
 const result=verifyR9dCandidate({bytes,evidence});
 console.log('GAME_ARTIST_R9D_REAL_PROVIDER_CONCEPT_BYTES_VERIFIED');
 console.log(JSON.stringify(result));
}
