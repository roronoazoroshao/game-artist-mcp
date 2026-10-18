import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {inspectR9dPaintPng} from '../src/ai-art/r9d-paint-intake.mjs';
const {PNG}=pngjs;
function paint({opaque=false,transparent=true}={}){
 const image=new PNG({width:64,height:64,colorType:6});
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const i=4*(y*64+x),inside=x>8&&x<55&&y>7&&y<57;
  image.data.set([45,120,170,opaque?255:inside?255:transparent?0:255],i);
 }
 return PNG.sync.write(image);
}
const source='https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a273eef3-2e12-49ef-8204-bad3ce001af1';
function evidence(){return {
 schemaVersion:1,partId:'body',provider:'Adobe Firefly',
 generationRequestId:'61fee9ba-8db0-4762-b0df-1cdcea5c6ae0',
 cutoutRequestId:'7b0708a3-4273-4dfa-928d-647b6474db28',
 cutoutOutputUrl:source,cutoutDimensions:{width:64,height:64},
 commercialRightsCleared:false,rigAligned:false,exportAllowed:false,
 artisticReview:'UNSCORED'
}}
test('R9d: capture real transparent source, compute digest without inventing provider attestation',()=>{
 const bytes=paint(),out=inspectR9dPaintPng({bytes,evidence:evidence()});
 assert.equal(out.status,'CAPTURED_UNVERIFIED');
 assert.equal(out.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(out.alphaHasTransparency,true);
 assert.equal(out.assetId,'spirit_lantern');
 assert.equal(out.partId,'body');
 assert.equal(out.exportAllowed,false);
 assert.equal(out.rigAligned,false);
});
test('R9d: reject opaque fake cutout, forged rights, altered dimensions, untrusted URL and corrupted PNG',()=>{
 const bytes=paint(),meta=evidence();
 for(const payload of [
  {bytes:paint({opaque:true}),evidence:meta},
  {bytes,evidence:{...meta,commercialRightsCleared:true}},
  {bytes,evidence:{...meta,rigAligned:true}},
  {bytes,evidence:{...meta,exportAllowed:true}},
  {bytes,evidence:{...meta,cutoutOutputUrl:'https://untrusted.invalid/steal.png'}},
  {bytes,evidence:{...meta,cutoutDimensions:{width:65,height:64}}},
  {bytes:bytes.subarray(0,bytes.length-8),evidence:meta}
 ]) assert.throws(()=>inspectR9dPaintPng(payload),/R9D_PAINT_REJECTED|AI_PNG_REJECTED/);
});
test('R9d: if an immutable SHA256 is expected it is exact byte-bound, not image similarity',()=>{
 const bytes=paint(),m=evidence(),digest=createHash('sha256').update(bytes).digest('hex');
 assert.equal(inspectR9dPaintPng({bytes,evidence:m,expectedSha256:digest}).status,'SHA_BOUND_UNATTESTED');
 assert.throws(()=>inspectR9dPaintPng({bytes,evidence:m,expectedSha256:'0'.repeat(64)}),/R9D_PAINT_REJECTED/);
});
