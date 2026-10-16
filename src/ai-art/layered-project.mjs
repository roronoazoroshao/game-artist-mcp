import {createHash} from 'node:crypto';
import {writeOpenRaster,readOpenRaster} from './openraster.mjs';
import {applyAlphaMask} from './layer-composite.mjs';
import {inspectAiPng} from './png-intake.mjs';
import {verifyProvenanceEvents,digestProvenanceEvents} from './provenance.mjs';
import {isValidatedLayeredSource} from './layered-source.mjs';

const fail=why=>{throw Error('R9B_PROJECT_REJECTED: '+why)};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const PARTS=new Set(['body','flame','talisman_left','talisman_right','tassel']);
const POSES=new Set(['flame_a','flame_b','flame_c','flame_d']);
const SHA=/^[0-9a-f]{64}$/;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function parseJson(content){
 if(typeof content!=='string'||Buffer.byteLength(content)>262144)fail('invalid sidecar size');
 try{return JSON.parse(content)}catch{fail('invalid sidecar JSON')}
}
function validPlacement(p,layer,canvas){
 if(!p||typeof p!=='object'||Array.isArray(p)||
 Object.keys(p).sort().join('|')!=='opacity|visible|x|y')fail('placement fields');
 if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x<0||p.y<0||
 p.x+layer.width>canvas.width||p.y+layer.height>canvas.height||
 typeof p.visible!=='boolean'||!Number.isFinite(p.opacity)||
 p.opacity<0||p.opacity>1)fail('placement outside master canvas');
 return p;
}
function allowFlamePose(layer){
 if(layer.partId!=='flame')return true;
 return layer.poseId==='flame_a';
}
/**
 * ORA stores editable *masked render layers*, while the two source Maps keep
 * unmasked paint and original mask PNG bytes non-destructively. ORA itself is
 * NOT proof of commercial rights nor a portable native-mask document.
 */
export function writeLayeredProject(source,{placements}={}){
 if(!isValidatedLayeredSource(source))fail('R9a/R9b validation boundary not met');
 const c=source.masterCanvas;
 if(c.width!==1024||c.height!==1280||
 source.runtimeCanvas.width!==256||source.runtimeCanvas.height!==320)
  fail('wrong master/runtime canvas');
 if(!(placements instanceof Map)||placements.size!==source.layers.length)
  fail('one placement per source layer required');
 verifyProvenanceEvents(source.operations);
 if(digestProvenanceEvents(source.operations)!==source.operationsAuditSha256)
  fail('audit digest changed after validation');
 const seenOrders=new Set();
 const sorted=[...source.layers].sort((a,b)=>a.order-b.order);
 const rendered=[],manifestLayers=[],layerPngs=new Map(),maskPngs=new Map();
 for(const layer of sorted){
  if(seenOrders.has(layer.order))fail('duplicate stack order');
  seenOrders.add(layer.order);
  const p=validPlacement(placements.get(layer.layerId),layer,c);
  if(!Buffer.isBuffer(layer.png)||sha(layer.png)!==layer.sourceSha256)
   fail('source changed after validation');
  const src=inspectAiPng(layer.png);
  if(src.width!==layer.width||src.height!==layer.height)fail('source geometry altered');
  let pixels=layer.png;
  if(layer.maskSha256!==null){
   if(!Buffer.isBuffer(layer.maskPng)||sha(layer.maskPng)!==layer.maskSha256)
    fail('mask changed after validation');
   pixels=applyAlphaMask(layer.png,layer.maskPng);
   maskPngs.set(layer.maskPath,Buffer.from(layer.maskPng));
  }
  layerPngs.set(layer.path,Buffer.from(layer.png));
  const visible=p.visible&&layer.visible&&allowFlamePose(layer);
  rendered.push({id:layer.layerId,png:pixels,x:p.x,y:p.y,
   opacity:p.opacity,visible});
  manifestLayers.push({layerId:layer.layerId,partId:layer.partId,
   poseId:layer.poseId,path:layer.path,maskPath:layer.maskPath,
   sourceSha256:layer.sourceSha256,maskSha256:layer.maskSha256,
   width:layer.width,height:layer.height,order:layer.order,
   x:p.x,y:p.y,opacity:p.opacity,visible});
 }
 for(const key of placements.keys())
  if(!source.layers.some(l=>l.layerId===key))fail('unlisted placement');
 // Group only adjacent layers with the same rig owner: one group per run.
 // Interleaved runs remain separate groups rather than silently changing
 // the artist's top-first z-order to gather all parts together.
 const usedIds=new Set(rendered.map(layer=>layer.id));
 const sequences=new Map(),children=[];
 let lastPart=null,group=null;
 for(const layer of manifestLayers){
  if(layer.partId!==lastPart){
   const seq=(sequences.get(layer.partId)??0)+1;
   sequences.set(layer.partId,seq);
   let id='rig_'+layer.partId+(seq===1?'':'_'+seq);
   while(usedIds.has(id))id+='_g';
   usedIds.add(id);
   group={type:'group',id,opacity:1,visible:true,
    isolation:'isolate',children:[]};
   children.push(group);
   lastPart=layer.partId;
  }
  group.children.push({type:'layer',id:layer.layerId});
 }
 const stackTree={type:'group',id:'root',children};
 const ora=writeOpenRaster({width:c.width,height:c.height,
  layers:rendered,stackTree});
 const manifest={
  version:1,assetId:source.assetId,origin:'R9A_IMPORTED_UNATTESTED',
  paintProviderAttested:false,artisticReview:'UNSCORED',
  rightsDecision:source.rightsStatus,exportAllowed:false,
  masterCanvas:c,runtimeCanvas:source.runtimeCanvas,
  rigManifestSha256:source.rigManifestSha256,
  operationsAuditSha256:source.operationsAuditSha256,
  oraSha256:sha(ora),layers:manifestLayers
 };
 const manifestJson=JSON.stringify(manifest,null,2)+'\n';
 const operationsJson=JSON.stringify(source.operations,null,2)+'\n';
 return {ora,manifestJson,operationsJson,layerPngs,maskPngs,
  evidence:Object.freeze({oraSha256:manifest.oraSha256,
   manifestSha256:sha(Buffer.from(manifestJson)),artisticReview:'UNSCORED',
   origin:manifest.origin,exportAllowed:false})};
}
export function verifyLayeredProject(files){
 if(!files||typeof files!=='object'||!Buffer.isBuffer(files.ora)||
 !(files.layerPngs instanceof Map)||!(files.maskPngs instanceof Map))
  fail('missing project files');
 const m=parseJson(files.manifestJson),ops=parseJson(files.operationsJson);
 if(!m||typeof m!=='object'||m.version!==1||
 m.assetId!=='spirit_lantern'||m.origin!=='R9A_IMPORTED_UNATTESTED'||
 m.paintProviderAttested!==false||m.artisticReview!=='UNSCORED'||
 m.exportAllowed!==false||!['RIGHTS_UNVERIFIED','COMMERCIAL_REVIEWED'].includes(m.rightsDecision)||
 m.masterCanvas?.width!==1024||m.masterCanvas?.height!==1280||
 m.runtimeCanvas?.width!==256||m.runtimeCanvas?.height!==320||
 typeof m.rigManifestSha256!=='string'||!SHA.test(m.rigManifestSha256)||
 !Array.isArray(m.layers)||m.layers.length<5||m.layers.length>24||
 sha(files.ora)!==m.oraSha256)fail('invalid/tampered source manifest');
 verifyProvenanceEvents(ops);
 if(digestProvenanceEvents(ops)!==m.operationsAuditSha256)
  fail('provenance log changed');
 const accepted=new Set(ops.filter(x=>x.accepted)
  .map(x=>[x.targetPart,x.outputSha256,x.maskSha256??''].join('/')));
 const doc=readOpenRaster(files.ora);
 if(doc.width!==1024||doc.height!==1280||
 doc.layers.length!==m.layers.length||
 files.layerPngs.size!==m.layers.length)fail('inconsistent ORA stack');
 const masked=m.layers.filter(l=>l.maskSha256!==null);
 if(files.maskPngs.size!==masked.length)fail('missing/surplus mask PNG');
 const ids=new Set(),sources=new Set(),masks=new Set(),orders=new Set();
 for(let i=0;i<m.layers.length;i++){
  const l=m.layers[i],actual=doc.layers[i];
  if(!l||typeof l!=='object'||typeof l.layerId!=='string'||
  !/^[a-z][a-z0-9_]{0,63}$/.test(l.layerId)||ids.has(l.layerId)||
  !PARTS.has(l.partId)|| (l.poseId!==null&&
  (l.partId!=='flame'||!POSES.has(l.poseId)))||
  typeof l.path!=='string'||!/^layers\/[a-z][a-z0-9_]{0,63}\.png$/.test(l.path)||
  sources.has(l.path)||!Number.isSafeInteger(l.order)||orders.has(l.order)||
  !SHA.test(l.sourceSha256||'')||
  (l.maskSha256!==null&&!SHA.test(l.maskSha256||'')))
   fail('invalid/duplicate layer metadata');
  ids.add(l.layerId);sources.add(l.path);orders.add(l.order);
  const p={x:l.x,y:l.y,opacity:l.opacity,visible:l.visible};
  validPlacement(p,l,m.masterCanvas);
  if(actual.id!==l.layerId||actual.x!==l.x||actual.y!==l.y||
  actual.opacity!==l.opacity||actual.visible!==l.visible)fail('ORA metadata mismatch');
  const original=files.layerPngs.get(l.path);
  if(!Buffer.isBuffer(original)||sha(original)!==l.sourceSha256)
   fail('missing/modified original PNG');
  const src=inspectAiPng(original);
  if(src.width!==l.width||src.height!==l.height)fail('modified original dimensions');
  let finalPng=original;
  if(l.maskSha256!==null){
   const expectedPath='masks/'+l.layerId+'.png';
   if(l.maskPath!==expectedPath||masks.has(expectedPath))
    fail('wrong/duplicate mask path');
   masks.add(expectedPath);
   const mask=files.maskPngs.get(expectedPath);
   if(!Buffer.isBuffer(mask)||sha(mask)!==l.maskSha256)fail('missing/modified mask PNG');
   finalPng=applyAlphaMask(original,mask);
  }else if(l.maskPath!==null)fail('untracked mask path');
  if(!finalPng.equals(actual.png))fail('editable ORA layer differs from hashed source/mask');
  if(!accepted.has([l.partId,l.sourceSha256,l.maskSha256??''].join('/')))
   fail('source mask not accepted in operations log');
 }
 for(const key of files.layerPngs.keys())if(!sources.has(key))fail('extra original layer');
 for(const key of files.maskPngs.keys())if(!masks.has(key))fail('extra mask PNG');
 for(const part of PARTS)if(!m.layers.some(l=>l.partId===part))fail('missing rig part');
 for(const pose of POSES)if(!m.layers.some(l=>l.poseId===pose))fail('missing flame pose');
 return Object.freeze({ok:true,exportAllowed:false,artisticReview:'UNSCORED',
  sourceCount:m.layers.length,maskCount:masked.length,
  oraSha256:sha(files.ora),rigManifestSha256:m.rigManifestSha256});
}
