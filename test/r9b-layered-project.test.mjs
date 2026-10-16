import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {makeProvenanceEvent,digestProvenanceEvents} from '../src/ai-art/provenance.mjs';
import {validateLayeredSource} from '../src/ai-art/layered-source.mjs';
import {writeLayeredProject,verifyLayeredProject} from '../src/ai-art/layered-project.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
import {applyAlphaMask} from '../src/ai-art/layer-composite.mjs';
const {PNG}=pngjs;
const hash=b=>createHash('sha256').update(b).digest('hex');
const parts=['body','flame','talisman_left','talisman_right','tassel'];
const poses=['flame_a','flame_b','flame_c','flame_d'];
function fixture(){
 const rigHash='a'.repeat(64);
 const brief={version:1,assetId:'spirit_lantern',masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},requiredParts:parts,poseIds:poses,styleDirection:'Original painted xianxia lantern',allowedProviders:['adobe_firefly']};
 const specs=[...parts.map(p=>[p,null]),...poses.map(p=>['flame',p])];
 const layers=new Map(),layerDefs=[],operations=[];
 let previous=null;
 for(let i=0;i<specs.length;i++){
  const [part,pose]=specs[i],name=part+(pose?'_'+pose:'')+'_paint',path='layers/'+name+'.png';
  const png=new PNG({width:2,height:2,colorType:6});
  for(let k=0;k<png.data.length;k+=4){png.data[k]=40+i;png.data[k+1]=80;png.data[k+2]=100;png.data[k+3]=255}
  const bytes=PNG.sync.write(png),value=hash(bytes);
  layers.set(path,bytes);
  layerDefs.push({layerId:name,partId:part,poseId:pose,path,width:2,height:2,sourceSha256:value,maskSha256:null,order:i,visible:true,alphaMode:'straight'});
  const event=makeProvenanceEvent({operationId:'op_'+String(i).padStart(4,'0'),provider:'adobe_firefly',modelId:'firefly_image_4',targetPart:part,promptSha256:rigHash,inputSha256:null,maskSha256:null,outputSha256:value,accepted:true},previous);
  previous=event.eventSha256;operations.push(event);
 }
 const pkg={version:1,assetId:'spirit_lantern',rigManifestSha256:rigHash,masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},parts,poseIds:poses,layers:layerDefs,operationsAuditSha256:digestProvenanceEvents(operations),rightsDecision:'RIGHTS_UNVERIFIED',rightsEvidenceRef:null,rightsReviewer:null};
 return {brief,pkg,layers,operations};
}

function masked(){
 const f=fixture();
 const mask=new PNG({width:2,height:2,colorType:6});
 for(let i=0;i<mask.data.length;i+=4)mask.data.set([0,0,0,255],i);
 const maskPng=PNG.sync.write(mask),maskHash=hash(maskPng),maskPngs=new Map();
 let previous=null;
 f.operations=[];
 for(let i=0;i<f.pkg.layers.length;i++){
  const layer=f.pkg.layers[i];
  const key='masks/'+layer.layerId+'.png';
  maskPngs.set(key,Buffer.from(maskPng));
  layer.maskSha256=maskHash;
  const event=makeProvenanceEvent({operationId:'op_'+String(i).padStart(4,'0'),
   provider:'adobe_firefly',modelId:'firefly_image_4',targetPart:layer.partId,
   promptSha256:f.pkg.rigManifestSha256,inputSha256:null,
   maskSha256:maskHash,outputSha256:layer.sourceSha256,accepted:true},previous);
  previous=event.eventSha256;f.operations.push(event);
 }
 f.pkg.operationsAuditSha256=digestProvenanceEvents(f.operations);
 return {brief:f.brief,pkg:f.pkg,layerPngs:f.layers,maskPngs,operations:f.operations,
  rigManifestSha256:f.pkg.rigManifestSha256};
}

function project(){
 const sample=masked(),validated=validateLayeredSource(sample);
 const placements=new Map(sample.pkg.layers.map((l,i)=>[l.layerId,{x:100+i*3,y:200+i*3,opacity:1,visible:true}]));
 return {validated,placements,packed:()=>writeLayeredProject(validated,{placements})};
}
const rejects=fn=>assert.throws(fn,/R9B_|R9A_|AI_PNG_REJECTED/);
test('R9b packages true 1024x1280 editable ORA source with independent masks and SHA-bound manifest',()=>{
 const p=project(),out=p.packed(),again=p.packed();
 assert.deepEqual(out.ora,again.ora,'deterministic OpenRaster bytes');
 assert.equal(out.manifestJson,again.manifestJson);
 const doc=readOpenRaster(out.ora);
 assert.deepEqual([doc.width,doc.height],[1024,1280]);
 assert.equal(doc.layers.length,9);
 assert.equal(doc.layers.filter(x=>x.id.startsWith('flame_flame_')&&x.visible).length,1);
 assert.equal(doc.layers.find(x=>x.id==='flame_paint').visible,false);
 const first=p.validated.layers[0],renderLayer=doc.layers.find(x=>x.id===first.layerId);
 assert.deepEqual(renderLayer.png,applyAlphaMask(first.png,first.maskPng));
 assert.equal(renderLayer.x,p.placements.get(first.layerId).x);
 assert.equal(out.layerPngs.get(first.path).equals(first.png),true);
 assert.equal(out.maskPngs.get(first.maskPath).equals(first.maskPng),true);
 const evidence=verifyLayeredProject(out);
 assert.equal(evidence.ok,true);
 assert.equal(evidence.exportAllowed,false);
 assert.equal(evidence.artisticReview,'UNSCORED');
});
test('R9b rejects mutating any archived source or editable mask after project creation',()=>{
 const p=project(),out=p.packed();
 const tampered={...out,maskPngs:new Map(out.maskPngs)};
 const firstKey=[...tampered.maskPngs.keys()][0];
 tampered.maskPngs.set(firstKey,Buffer.from('tampered'));rejects(()=>verifyLayeredProject(tampered));
 const missing={...out,layerPngs:new Map(out.layerPngs)};
 missing.layerPngs.delete([...missing.layerPngs.keys()][0]);rejects(()=>verifyLayeredProject(missing));
 const manifest=JSON.parse(out.manifestJson);manifest.layers[0].sourceSha256='f'.repeat(64);
 rejects(()=>verifyLayeredProject({...out,manifestJson:JSON.stringify(manifest)}));
 rejects(()=>verifyLayeredProject({...out,ora:Buffer.alloc(32)}));
});
test('R9b rejects placements outside canvas or missing/extra art layout; rights are blocked',()=>{
 const p=project();
 const bad=new Map(p.placements);
 bad.set(p.validated.layers[0].layerId,{x:1024,y:1280,opacity:1,visible:true});
 rejects(()=>writeLayeredProject(p.validated,{placements:bad}));
 const absent=new Map(p.placements);absent.delete(p.validated.layers[0].layerId);
 rejects(()=>writeLayeredProject(p.validated,{placements:absent}));
 const fake=new Map(p.placements);fake.set('unknown',{x:1,y:1,opacity:1,visible:true});
 rejects(()=>writeLayeredProject(p.validated,{placements:fake}));
 const out=p.packed();const m=JSON.parse(out.manifestJson);
 assert.equal(m.rightsDecision,'RIGHTS_UNVERIFIED');
 assert.equal(m.paintProviderAttested,false);
});

test('R9b refuses forged validation objects and mutated operations provenance',()=>{
 const p=project();
 rejects(()=>writeLayeredProject({...p.validated},{placements:p.placements}));
 const out=p.packed();
 const altered=JSON.parse(out.operationsJson);
 altered[0].accepted=false;
 rejects(()=>verifyLayeredProject({...out,operationsJson:JSON.stringify(altered)}));
 const noLog={...out};delete noLog.operationsJson;
 rejects(()=>verifyLayeredProject(noLog));
});
