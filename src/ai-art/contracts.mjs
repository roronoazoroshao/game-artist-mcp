const FAIL=(reason)=>{throw Error('R9A_INVALID_CONTRACT: '+reason)};
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const SHA=/^[0-9a-f]{64}$/;
const LAYER=/^layers\/[a-z][a-z0-9_]{0,63}\.png$/;
const PARTS=['body','flame','talisman_left','talisman_right','tassel'];
const POSES=['flame_a','flame_b','flame_c','flame_d'];
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
function exact(o,fields,reason){
 if(!isRecord(o)||Object.keys(o).sort().join('|')!==fields.slice().sort().join('|'))FAIL(reason+' fields');
}
function sameArray(input,expected,name){
 if(!Array.isArray(input)||input.length!==expected.length||
    input.some((x,i)=>x!==expected[i]))FAIL(name+' must preserve canonical Spirit Lantern IDs');
}
function canvas(x,context){
 exact(x,['width','height'],context);
 if(!Number.isSafeInteger(x.width)||!Number.isSafeInteger(x.height)||
 x.width<1||x.height<1||x.width>4096||x.height>4096||x.width*x.height>4194304)FAIL(context+' dimensions');
}
function nonEmpty(s,max=256){return typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=max}
function sha(s,name){if(typeof s!=='string'||!SHA.test(s))FAIL(name+' SHA256')}
export function assertSafeLayerPath(path){
 if(typeof path!=='string'||!LAYER.test(path))FAIL('unsafe layer path');
 return path;
}
export function validateArtBrief(brief){
 exact(brief,['version','assetId','masterCanvas','runtimeCanvas','requiredParts','poseIds','styleDirection','allowedProviders'],'ArtBrief');
 if(brief.version!==1||brief.assetId!=='spirit_lantern'||!nonEmpty(brief.styleDirection,500))FAIL('ArtBrief id/style');
 canvas(brief.masterCanvas,'master canvas');canvas(brief.runtimeCanvas,'runtime canvas');
 if(brief.masterCanvas.width!==1024||brief.masterCanvas.height!==1280||
 brief.runtimeCanvas.width!==256||brief.runtimeCanvas.height!==320)FAIL('R9 vertical slice canvas sizes');
 sameArray(brief.requiredParts,PARTS,'parts');sameArray(brief.poseIds,POSES,'poses');
 if(!Array.isArray(brief.allowedProviders)||!brief.allowedProviders.length||brief.allowedProviders.length>5||
 new Set(brief.allowedProviders).size!==brief.allowedProviders.length||
 brief.allowedProviders.some(x=>typeof x!=='string'||!ID.test(x)))FAIL('provider allowlist');
 return Object.freeze({ok:true});
}
export function validateRasterPackage(pkg){
 exact(pkg,['version','assetId','rigManifestSha256','masterCanvas','runtimeCanvas','parts','poseIds','layers','operationsAuditSha256','rightsDecision','rightsEvidenceRef','rightsReviewer'],'RasterPackage');
 if(pkg.version!==1||pkg.assetId!=='spirit_lantern')FAIL('RasterPackage asset/version');
 sha(pkg.rigManifestSha256,'rig');sha(pkg.operationsAuditSha256,'operations audit');
 canvas(pkg.masterCanvas,'master canvas');canvas(pkg.runtimeCanvas,'runtime canvas');
 if(pkg.masterCanvas.width!==1024||pkg.masterCanvas.height!==1280||
 pkg.runtimeCanvas.width!==256||pkg.runtimeCanvas.height!==320)FAIL('raster canvas scale');
 sameArray(pkg.parts,PARTS,'parts');sameArray(pkg.poseIds,POSES,'poses');
 if(!Array.isArray(pkg.layers)||!pkg.layers.length||pkg.layers.length>80)FAIL('layer count');
 const names=new Set(),paths=new Set();
 for(const layer of pkg.layers){
  exact(layer,['layerId','partId','poseId','path','width','height','sourceSha256','maskSha256','order','visible','alphaMode'],'layer');
  if(!ID.test(layer.layerId)||!PARTS.includes(layer.partId))FAIL('layer identity/ownership');
  if(layer.poseId!==null&&(!POSES.includes(layer.poseId)||layer.partId!=='flame'))FAIL('pose ownership');
  assertSafeLayerPath(layer.path);sha(layer.sourceSha256,'layer');
  if(layer.maskSha256!==null)sha(layer.maskSha256,'mask');
  if(!Number.isSafeInteger(layer.width)||!Number.isSafeInteger(layer.height)||
 layer.width<1||layer.height<1||layer.width>4096||layer.height>4096||
 layer.width*layer.height>4194304)FAIL('layer dimensions');
  if(!Number.isSafeInteger(layer.order)||layer.order<0||layer.order>255||
 typeof layer.visible!=='boolean'||layer.alphaMode!=='straight')FAIL('layer render properties');
  if(names.has(layer.layerId)||paths.has(layer.path))FAIL('duplicate layer path/id');
  names.add(layer.layerId);paths.add(layer.path);
 }
 if(!['RIGHTS_UNVERIFIED','COMMERCIAL_REVIEWED'].includes(pkg.rightsDecision))FAIL('rights status');
 if(pkg.rightsDecision==='RIGHTS_UNVERIFIED'){
  if(pkg.rightsEvidenceRef!==null||pkg.rightsReviewer!==null)FAIL('unverified rights must carry null review evidence');
 }else if(!nonEmpty(pkg.rightsEvidenceRef,128)||!ID.test(pkg.rightsEvidenceRef)||
 !nonEmpty(pkg.rightsReviewer,64)||!ID.test(pkg.rightsReviewer))FAIL('reviewed rights require reviewer and evidence reference');
 return Object.freeze({ok:true,rightsDecision:pkg.rightsDecision});
}
export function assertRasterExportable(pkg){
 validateRasterPackage(pkg);
 if(pkg.rightsDecision==='RIGHTS_UNVERIFIED')FAIL('RIGHTS_UNVERIFIED blocks export');
 throw Error('R9A_INVALID_RIGHTS: a self-declared commercial review is not independently authenticated; R9a is import-only');
}
