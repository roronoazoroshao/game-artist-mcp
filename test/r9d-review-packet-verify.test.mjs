import test from 'node:test';
import assert from 'node:assert/strict';
import {validateR9dReviewManifest,preflightR9dPngHeader} from '../src/ai-art/r9d-review-packet-verify.mjs';

const SHA='1'.repeat(64),ORA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const HEAD='e0bcf74feb7a92f4717669eae5f34de6423079d2';
function fixture(){
 const files={};
 for(const v of ['A','B']){
  for(const size of [64,128])for(let i=0;i<120;i++)
   files[`variants/${v}/${size}/frame-${String(i).padStart(3,'0')}.png`]=SHA;
  for(const time of Array.from({length:15},(_,i)=>i*125))
   files[`variants/${v}/512-static/${String(time).padStart(4,'0')}.png`]=SHA;
 }
 return {kind:'R10_BLIND_REVIEW_UNSCORED',sourceHead:HEAD,sourceRun:39117042663,
  sourceArtifactId:12133305348,sourceOraSha256:ORA,sealCommitmentSha256:'2'.repeat(64),
  sampling:'GODOT_DETERMINISTIC_120HZ_SEEK_EVEN_TICKS_FOR_60FPS_VIEWER',
  physicalDisplayTimingMeasured:false,exportAllowed:false,rightsVerified:false,
  humanReviewStatus:'PENDING',framesPerVariant60Hz:120,
  static512TimesMs:Array.from({length:15},(_,i)=>i*125),files};
}
const invalid=(fn)=>assert.throws(fn,/R9D_REVIEW_PACKET_REJECTED/);

test('R9d blind packet manifest validates complete source-anchored 510 frames without artistic release claims',()=>{
 const out=validateR9dReviewManifest(fixture(),{expectedSourceHead:HEAD});
 assert.equal(out.imageCount,510);
 assert.equal(out.candidateIdentity,'SEALED_A_B_MAPPING');
 assert.equal(out.artisticReview,'REVIEW_PENDING');
 assert.equal(out.commercialRightsCleared,false);
 assert.equal(out.exportAllowed,false);
});
test('R9d blind packet manifest rejects size gaps, traversal, tampered rights and fabricated reviewer GO',()=>{
 const changes=[
  m=>{delete m.files['variants/A/64/frame-000.png'];},
  m=>{m.files['variants/A/64/frame-000.png']='00';},
  m=>{m.files['variants/A/64/../frame-000.png']=SHA;},
  m=>{m.files['internal/sealed-mapping.json']=SHA;},
  m=>{m.humanReviewStatus='ARTISTIC_GO';},
  m=>{m.rightsVerified=true;},
  m=>{m.exportAllowed=true;},
  m=>{m.physicalDisplayTimingMeasured=true;},
  m=>{m.sourceHead='f'.repeat(40);},
  m=>{m.static512TimesMs[4]=m.static512TimesMs[3];},
  m=>{m.framesPerVariant60Hz=60;},
  m=>{m.kind='UNVERIFIED_ARBITRARY_ZIP';},
  m=>{m.extraSource='unsigned';}
 ];
 for(const change of changes){
  const x=fixture();change(x);
  invalid(()=>validateR9dReviewManifest(x,{expectedSourceHead:HEAD}));
 }
});
test('R9d blind packet manifest requires pinned source identity and non-forgeable restricted statuses',()=>{
 const m=fixture();
 invalid(()=>validateR9dReviewManifest(m,{expectedSourceHead:'0'.repeat(40)}));
 invalid(()=>validateR9dReviewManifest({...m,sourceOraSha256:'f'.repeat(64)},{expectedSourceHead:HEAD}));
 invalid(()=>validateR9dReviewManifest({...m,sealCommitmentSha256:'wrong'},{expectedSourceHead:HEAD}));
});

test('R9d PNG bounded header preflight rejects massive declared dimensions before decoder inflation',()=>{
 const b=Buffer.alloc(33);
 Buffer.from('89504e470d0a1a0a','hex').copy(b);
 b.writeUInt32BE(13,8);b.write('IHDR',12);
 b.writeUInt32BE(64,16);b.writeUInt32BE(64,20);
 b[24]=8;b[25]=6;b[26]=0;b[27]=0;b[28]=0;
 assert.equal(preflightR9dPngHeader(b,64),true);
 const oversized=Buffer.from(b);oversized.writeUInt32BE(0x7fffffff,16);
 invalid(()=>preflightR9dPngHeader(oversized,64));
 const nonrgba=Buffer.from(b);nonrgba[25]=2;
 invalid(()=>preflightR9dPngHeader(nonrgba,64));
});
