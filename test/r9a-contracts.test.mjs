import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArtBrief,validateRasterPackage,assertSafeLayerPath,assertRasterExportable} from '../src/ai-art/contracts.mjs';

const sha='a'.repeat(64);
const parts=['body','flame','talisman_left','talisman_right','tassel'];
const poses=['flame_a','flame_b','flame_c','flame_d'];
const brief=()=>({version:1,assetId:'spirit_lantern',masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},requiredParts:parts,poseIds:poses,styleDirection:'Original xianxia painterly lantern',allowedProviders:['adobe_firefly']});
const layer=(part,pose=null)=>({layerId:part+(pose?'_'+pose:'')+'_paint',partId:part,poseId:pose,path:'layers/'+part+(pose?'_'+pose:'')+'_paint.png',width:2,height:2,sourceSha256:sha,maskSha256:null,order:1,visible:true,alphaMode:'straight'});
const pkg=()=>({version:1,assetId:'spirit_lantern',rigManifestSha256:sha,masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},parts,poseIds:poses,layers:[...parts.map(p=>layer(p)),...poses.map(p=>layer('flame',p))],operationsAuditSha256:sha,rightsDecision:'RIGHTS_UNVERIFIED',rightsEvidenceRef:null,rightsReviewer:null});

test('R9a brief requires stable five-part rig, allowed providers and safe dimensions',()=>{
 assert.equal(validateArtBrief(brief()).ok,true);
 const bad={...brief(),extra:'silent'};assert.throws(()=>validateArtBrief(bad),/R9A_INVALID_/);
 const duplicate={...brief(),requiredParts:['body','body']};assert.throws(()=>validateArtBrief(duplicate),/R9A_INVALID_/);
 assert.throws(()=>validateArtBrief({...brief(),allowedProviders:['http://host/evil']}),/R9A_INVALID_/);
 assert.throws(()=>validateArtBrief({...brief(),masterCanvas:{width:8000,height:8000}}),/R9A_INVALID_/);
});
test('R9a rejects URL, traversal, whitespace and non-canonical layer paths',()=>{
 assert.equal(assertSafeLayerPath('layers/body_paint.png'),'layers/body_paint.png');
 for(const unsafe of ['../body.png','layers/../../evil.png','/layers/body.png','layers\\evil.png','layers/.hidden.png','https://evil/x.png','layers/UPPER.png','layers//x.png','layers/body.jpg','layers/%2e%2e.png','layers/x a.png']) {
  assert.throws(()=>assertSafeLayerPath(unsafe),/R9A_INVALID_/,unsafe);
 }
});
test('R9a raster package binds layer ownership, hashes and statuses and never automatically clears rights',()=>{
 assert.equal(validateRasterPackage(pkg()).ok,true);
 assert.throws(()=>assertRasterExportable(pkg()),/RIGHTS_UNVERIFIED/);
 const invalids=[
  {...pkg(),layers:[pkg().layers[0],pkg().layers[0]]},
  {...pkg(),layers:[{...pkg().layers[0],partId:'stranger'},...pkg().layers.slice(1)]},
  {...pkg(),layers:[{...pkg().layers[0],sourceSha256:'bad'},...pkg().layers.slice(1)]},
  {...pkg(),layers:[{...pkg().layers[0],path:'layers/../../x.png'},...pkg().layers.slice(1)]},
  {...pkg(),layers:[{...pkg().layers[0],poseId:'flame_a'},...pkg().layers.slice(1)]},
  {...pkg(),operationsAuditSha256:'invalid'},
  {...pkg(),rightsDecision:'AUTO_APPROVED'},
  {...pkg(),extra:'prompt injection'},
  {...pkg(),layers:[]}
 ];
 for(const candidate of invalids)assert.throws(()=>validateRasterPackage(candidate),/R9A_INVALID_/);
 const reviewed={...pkg(),rightsDecision:'COMMERCIAL_REVIEWED',rightsEvidenceRef:'review_20261016',rightsReviewer:'reviewer_owner'};
 assert.equal(validateRasterPackage(reviewed).ok,true);
 assert.throws(()=>assertRasterExportable(reviewed),/R9A_INVALID_RIGHTS/, 'unverified caller-supplied reviewer names must not unlock export');
 assert.throws(()=>assertRasterExportable({...reviewed,rightsReviewer:null}),/R9A_INVALID_/);
});
