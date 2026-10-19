import {createHash,randomBytes} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,rename,rm,mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {assertAssetId} from '../mcp/store.mjs';
import {inspectAiPng} from './png-intake.mjs';

const {PNG}=pngjs;
const MAX_STATE=512*1024,MAX_SIDE=256,MAX_REVISIONS=96,MAX_OPS=256;
const MAX_BRUSHES=64,MAX_DABS=850,MAX_BRUSH_WORK=600000;
const MAX_IMPORT_PNG_BYTES=96*1024,MAX_IMPORTS=2;
const ID=/^[a-z][a-z0-9_]{0,31}$/;
const HEX=/^#[0-9a-fA-F]{6}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error('PAINT_REJECTED: '+s)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,names)=>{if(!obj(x)||Object.keys(x).some(k=>!names.includes(k)))fail('unrecognized field');};
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const plainClone=x=>JSON.parse(JSON.stringify(x));
const assertProject=p=>{
 if(!obj(p)||p.version!==1||!Number.isSafeInteger(p.revision)||p.revision<0||
 !Number.isSafeInteger(p.width)||!Number.isSafeInteger(p.height)||p.width<1||p.height<1||
 p.width>MAX_SIDE||p.height>MAX_SIDE||!Array.isArray(p.history)||
 p.history.length!==p.revision||p.revision>MAX_REVISIONS||
 p.rightsVerified!==false||p.exportAllowed!==false||p.artisticReview!=='UNSCORED'||
 Object.keys(p).some(k=>!['version','revision','width','height','history','rightsVerified','artisticReview','exportAllowed'].includes(k)))
 fail('invalid stored paint project');
 if(JSON.stringify(p).length>MAX_STATE)fail('project history too large');
 return p;
};
const validateMask=(mask,w,h)=>{
 if(mask===null)return null;
 exact(mask,['x','y','width','height']);
 if(![mask.x,mask.y,mask.width,mask.height].every(Number.isSafeInteger)||mask.x<0||mask.y<0||
 mask.width<1||mask.height<1||mask.x+mask.width>w||mask.y+mask.height>h)fail('mask bounds');
 return {...mask};
};
const newLayer=(id,w,h)=>({id,opacity:1,visible:true,mask:null,data:new Uint8ClampedArray(w*h*4)});
function compositePixel(d,ix,r,g,b,a,erase=false){
 a=Math.max(0,Math.min(1,a));
 const old=d[ix+3]/255;
 if(erase){const next=old*(1-a);d[ix+3]=Math.round(next*255);return;}
 const total=a+old*(1-a);
 if(total<=0)return;
 d[ix]=Math.round((r*a+d[ix]*old*(1-a))/total);
 d[ix+1]=Math.round((g*a+d[ix+1]*old*(1-a))/total);
 d[ix+2]=Math.round((b*a+d[ix+2]*old*(1-a))/total);
 d[ix+3]=Math.round(total*255);
}
function paintDot(layer,point,brush,w,h){
 const [cx,cy,pressure]=point;
 const radius=brush.radius*pressure;
 if(radius<0.05)return;
 const [r,g,b]=brush.rgb;
 for(let y=Math.max(0,Math.floor(cy-radius-1));y<=Math.min(h-1,Math.ceil(cy+radius+1));y++)
  for(let x=Math.max(0,Math.floor(cx-radius-1));x<=Math.min(w-1,Math.ceil(cx+radius+1));x++){
   const distance=Math.hypot(x+.5-cx,y+.5-cy);
   const coverage=Math.max(0,Math.min(1,radius+.5-distance));
   if(coverage>0)compositePixel(layer.data,4*(y*w+x),r,g,b,brush.opacity*coverage,brush.erase);
  }
}
function stroke(layer,op,w,h,budget){
 const points=op.points;
 const rgb=op.type==='stroke.erase'?[0,0,0]:[1,3,5].map(off=>parseInt(op.color.slice(off,off+2),16));
 const brush={radius:op.radius,opacity:op.opacity,rgb,erase:op.type==='stroke.erase'};
 let count=1;
 for(let i=0;i<points.length-1;i++){
  const distance=Math.hypot(points[i][0]-points[i+1][0],points[i][1]-points[i+1][1]);
  const steps=Math.max(1,Math.ceil(distance/Math.max(.75,op.radius*.35)));
  if(steps>1024)fail('stroke path sampling budget');
  count+=steps;
 }
 if(count>MAX_DABS)fail('stroke sampling budget');
 const cost=count*Math.pow(Math.ceil(2*op.radius+3),2);
 if(budget.work+cost>MAX_BRUSH_WORK||budget.brushes>=MAX_BRUSHES)fail('cumulative brush work budget');
 budget.work+=cost;budget.brushes++;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[i+1];
  if(!b){paintDot(layer,a,brush,w,h);break;}
  const distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
  const steps=Math.max(1,Math.ceil(distance/Math.max(.75,op.radius*.35)));
  for(let j=0;j<steps;j++){
   const t=j/steps;
   paintDot(layer,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],brush,w,h);
  }
 }
}

function applyOps(layers,ops,w,h,budget){
 if(!Array.isArray(ops)||ops.length<1||ops.length>12)fail('batch op count');
 for(const op of ops){
  if(!obj(op))fail('invalid paint operation');
  if(op.type==='layer.import_png'){
   exact(op,['type','layerId','pngBase64','sourceSha256','sourceLabel','rightsVerified']);
   if(budget.imports>=MAX_IMPORTS)fail('import quota exhausted');
   if(typeof op.layerId!=='string'||!ID.test(op.layerId)||layers.length>=8||
      layers.some(l=>l.id===op.layerId)||op.rightsVerified!==false)
     fail('invalid imported layer or unverified-rights contract');
   if(typeof op.sourceLabel!=='string'||!/^[a-zA-Z0-9][ a-zA-Z0-9_.-]{0,47}$/.test(op.sourceLabel))
     fail('invalid source label');
   const bytes=decodeImport(op.pngBase64,w,h);
   if(sha(bytes)!==op.sourceSha256)fail('source digest mismatch');
   const pixels=PNG.sync.read(bytes,{checkCRC:true});
   const layer=newLayer(op.layerId,w,h);
   layer.data.set(pixels.data);
   layers.push(layer);budget.imports++;
   continue;
  }
  if(op.type==='layer.create'){
   exact(op,['type','layerId']);
   if(typeof op.layerId!=='string'||!ID.test(op.layerId)||layers.length>=8||layers.some(l=>l.id===op.layerId))fail('duplicate/invalid layer or budget');
   layers.push(newLayer(op.layerId,w,h));continue;
  }
  if(typeof op.layerId!=='string'||!ID.test(op.layerId))fail('layer ID');
  const layer=layers.find(l=>l.id===op.layerId);
  if(!layer)fail('unknown layer');
  if(op.type==='layer.settings'){
   exact(op,['type','layerId','opacity','visible','mask']);
   if(!('opacity'in op)&&!('visible'in op)&&!('mask'in op))fail('empty layer settings');
   if('opacity'in op){if(!finite(op.opacity,0,1))fail('layer opacity');layer.opacity=op.opacity;}
   if('visible'in op){if(typeof op.visible!=='boolean')fail('layer visibility');layer.visible=op.visible;}
   if('mask'in op)layer.mask=validateMask(op.mask,w,h);
   continue;
  }
  if(op.type==='stroke.draw'||op.type==='stroke.erase'){
   exact(op,['type','layerId','color','radius','opacity','points']);
   if(op.type==='stroke.draw'&&(typeof op.color!=='string'||!HEX.test(op.color)))fail('stroke color');
   if(op.type==='stroke.erase'&&op.color!==undefined)fail('erase color disallowed');
   if(!finite(op.radius,.5,24)||!finite(op.opacity,0,1)||!Array.isArray(op.points)||
     op.points.length<1||op.points.length>64)fail('brush input bounds');
   for(const p of op.points)if(!Array.isArray(p)||p.length!==3||
     !finite(p[0],0,w)||!finite(p[1],0,h)||!finite(p[2],.05,1))
     fail('invalid pressure point');
   stroke(layer,op,w,h,budget);continue;
  }
  fail('unknown painting instruction');
 }
}
function evaluated(p,revision=p.revision,depth=0){
 if(!Number.isSafeInteger(revision)||revision<0||revision>p.revision||depth>8)fail('invalid historical revision');
 let layers=[newLayer('base',p.width,p.height)];
 const budget={work:0,brushes:0,imports:0};
 for(let i=0;i<revision;i++){
  const entry=p.history[i];
  if(!obj(entry)||!Array.isArray(entry.operations)||entry.operations.length<1)fail('history entry');
  if(entry.operations.length===1&&entry.operations[0]?.type==='restore'){
   const target=entry.operations[0].targetRevision;
   if(!Number.isSafeInteger(target)||target<0||target>i)fail('invalid restore reference');
   layers=evaluated(p,target,depth+1);continue;
  }
  if(entry.operations.some(op=>op?.type==='restore'))fail('mixed restore');
  applyOps(layers,entry.operations,p.width,p.height,budget);
 }
 return layers;
}
function raster(p,revision=p.revision){
 const layers=evaluated(p,revision);
 const data=new Uint8ClampedArray(p.width*p.height*4);
 for(const layer of layers){
  if(!layer.visible||layer.opacity<=0)continue;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
   if(layer.mask&&(x<layer.mask.x||y<layer.mask.y||
      x>=layer.mask.x+layer.mask.width||y>=layer.mask.y+layer.mask.height))continue;
   const i=4*(y*p.width+x),a=layer.data[i+3]/255*layer.opacity;
   if(a>0)compositePixel(data,i,layer.data[i],layer.data[i+1],layer.data[i+2],a);
  }
 }
 return data;
}
/** Accept only bounded, canonical, first-party-supplied base64 PNG; no URL or file path.
 * The source label is a user claim, never a verified copyright assertion. */
function decodeImport(imageBase64,width,height){
 if(typeof imageBase64!=='string'||imageBase64.length<32||
    imageBase64.length>Math.ceil(MAX_IMPORT_PNG_BYTES/3)*4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageBase64))
  fail('noncanonical or oversized base64 source');
 const bytes=Buffer.from(imageBase64,'base64');
 if(bytes.length>MAX_IMPORT_PNG_BYTES||bytes.toString('base64')!==imageBase64)
  fail('noncanonical source PNG encoding');
 let metadata;
 try{metadata=inspectAiPng(bytes);}catch{fail('unsafe PNG header, chunk, or CRC');}
 if(metadata.width!==width||metadata.height!==height)fail('PNG geometry must match canvas');
 return bytes;
}
export function renderPaintDiff(baseline,candidate,{size=64}={}){
 if(![64,128].includes(size))fail('invalid diff size');
 const metrics=analyzePaintDifference(baseline,candidate,{size});
 const old=PNG.sync.read(renderPaint(baseline,{size}).png).data;
 const cur=PNG.sync.read(renderPaint(candidate,{size}).png).data;
 const mask=new PNG({width:size,height:size});
 for(let i=0;i<old.length;i+=4){
  const delta=Math.max(...[0,1,2,3].map(k=>Math.abs(old[i+k]-cur[i+k])));
  if(delta!==0){
   mask.data[i]=255;mask.data[i+1]=Math.max(0,255-delta);
   mask.data[i+2]=0;mask.data[i+3]=255;
  }else{
   mask.data[i]=32;mask.data[i+1]=32;mask.data[i+2]=40;mask.data[i+3]=32;
  }
 }
 const png=PNG.sync.write(mask);
 return {status:'TECHNICAL_DIFF_ONLY',png,sha256:sha(png),size,
  changedPixels:metrics.changedPixels,baselineSha256:metrics.baselineSha256,
  candidateSha256:metrics.candidateSha256,artisticReview:'UNSCORED',exportAllowed:false};
}
/** A bounded objective stopping rule for an externally orchestrated visual critic.
 * It never calls an LLM, evaluates beauty, or grants Artistic GO. */
export function evaluatePaintProgress(baseline,candidate,{size=64,minCoverage=0,maxCoverage=1,
 minChangedPixels=1,maxIterations=3}={}){
 if(![64,128].includes(size)||!finite(minCoverage,0,1)||!finite(maxCoverage,0,1)||
    minCoverage>maxCoverage||!Number.isSafeInteger(minChangedPixels)||minChangedPixels<0||
    minChangedPixels>size*size||!Number.isSafeInteger(maxIterations)||maxIterations<1||maxIterations>8||
    !Number.isSafeInteger(baseline.revision)||!Number.isSafeInteger(candidate.revision)||
    candidate.revision<baseline.revision)
  fail('untrusted objective critic rubric');
 const metrics=analyzePaintDifference(baseline,candidate,{size});
 const target=renderPaint(candidate,{size});
 const coverage=target.metrics.coverage;
 const satisfied=coverage>=minCoverage&&coverage<=maxCoverage&&metrics.changedPixels>=minChangedPixels;
 const iteration=candidate.revision-baseline.revision;
 return Object.freeze({result:satisfied?'OBJECTIVE_TARGET_MET':iteration>=maxIterations?'RETRY_BUDGET_EXHAUSTED':'REVISION_REQUIRED',
   metrics:{...metrics,candidateCoverage:coverage},iteration,maxIterations,
   humanOrAiVisualInspectionRequired:true,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false});
}
export function renderPaint(project,{revision=project.revision,size=null}={}){
 const p=assertProject(project),raw=raster(p,revision);
 if(size!==null&&![64,128].includes(size))fail('unsupported preview size');
 const w=size??p.width,h=size??p.height;
 const image=new PNG({width:w,height:h});
 let occupied=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const xx=Math.min(p.width-1,Math.floor((x+.5)*p.width/w));
  const yy=Math.min(p.height-1,Math.floor((y+.5)*p.height/h));
  const from=4*(yy*p.width+xx),to=4*(y*w+x);
  for(let c=0;c<4;c++)image.data[to+c]=raw[from+c];
  if(image.data[to+3]>16)occupied++;
 }
 const png=PNG.sync.write(image);
 return {png,sha256:sha(png),width:w,height:h,metrics:{occupiedPixels:occupied,coverage:Math.round(occupied/(w*h)*10000)/10000},revision};
}
export function analyzePaintDifference(baseline,candidate,{size=64}={}){
 if(baseline.width!==candidate.width||baseline.height!==candidate.height)fail('different canvas geometry');
 const a=renderPaint(baseline,{size}),b=renderPaint(candidate,{size});
 const aa=PNG.sync.read(a.png).data,bb=PNG.sync.read(b.png).data;
 let changed=0,totalDelta=0;
 for(let i=0;i<aa.length;i+=4){
  let delta=0;for(let k=0;k<4;k++)delta+=Math.abs(aa[i+k]-bb[i+k]);
  if(delta>0)changed++;totalDelta+=delta;
 }
 return {status:'OBJECTIVE_PIXEL_METRICS_ONLY',size,changedPixels:changed,meanChannelDelta:Math.round(totalDelta/(aa.length)*1e4)/1e4,
  baselineRevision:baseline.revision,candidateRevision:candidate.revision,
  baselineSha256:a.sha256,candidateSha256:b.sha256,baselineCoverage:a.metrics.coverage,candidateCoverage:b.metrics.coverage,
  artisticReview:'UNSCORED'};
}
async function readSafe(path,max=MAX_STATE){
 let handle;
 try{
  const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>max)fail('unsafe or oversized project');
  handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const meta=await handle.stat();if(!meta.isFile()||meta.size>max)fail('unsafe painting bytes');
  let data=Buffer.alloc(0),total=0;const chunk=Buffer.allocUnsafe(65536);
  for(;;){const {bytesRead}=await handle.read(chunk,0,chunk.length,null);if(bytesRead===0)break;total+=bytesRead;if(total>max)fail('state read budget');data=Buffer.concat([data,chunk.subarray(0,bytesRead)])}
  return data;
 }catch(e){if(e.code==='ELOOP')fail('unsafe painting symlink');throw e}
 finally{if(handle)await handle.close()}
}
async function writeAtomic(path,data,{create=false}={}){
 const bytes=Buffer.from(JSON.stringify(data)+'\n');
 if(bytes.length>MAX_STATE)fail('paint state byte budget');
 if(create){const fh=await open(path,'wx',0o600);try{await fh.writeFile(bytes);await fh.sync()}finally{await fh.close()};return;}
 const temp=path+'.'+randomBytes(12).toString('hex')+'.tmp';
 try{const fh=await open(temp,'wx',0o600);try{await fh.writeFile(bytes);await fh.sync()}finally{await fh.close()};await rename(temp,path)}
 finally{await rm(temp,{force:true})}
}
export class PaintWorkspace{
 constructor(assetStore){this.store=assetStore;}
 path(assetId){return join(this.store.assetDir(assetId),'painting.json');}
 async load(assetId){
  assertAssetId(assetId);
  const directory=this.store.assetDir(assetId);
  for(const path of [this.store.root,join(this.store.root,'assets'),directory]){
   const st=await lstat(path);
   if(!st.isDirectory()||st.isSymbolicLink())fail('unsafe asset directory');
  }
  const data=await readSafe(this.path(assetId));
  let p;try{p=JSON.parse(data.toString('utf8'))}catch{fail('invalid JSON')}
  assertProject(p);evaluated(p);return p;
 }
 async open(assetId){
  const source=await this.store.load(assetId);
  const {width,height}=source.document.canvas;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>MAX_SIDE||height>MAX_SIDE)
   fail('native paint V1 supports 1..256px integer canvases');
  return this.store.withAssetWriteLock(assetId,async()=>{
   try{return await this.load(assetId)}
   catch(e){if(e.code!=='ENOENT')throw e}
   const p={version:1,width,height,revision:0,history:[],rightsVerified:false,artisticReview:'UNSCORED',exportAllowed:false};
   await writeAtomic(this.path(assetId),p,{create:true});return p;
  });
 }
 async applyLocked(assetId,{expectedRevision,operations}={}){
   const p=await this.load(assetId);
   if(expectedRevision!==p.revision)throw Error('revision conflict: expected '+p.revision);
   if(p.revision>=MAX_REVISIONS)fail('revision budget');
   const next={...p,revision:p.revision+1,history:[...p.history,{operations:plainClone(operations)}]};
   if(next.history.reduce((n,e)=>n+e.operations.length,0)>MAX_OPS)fail('operation budget');
   evaluated(next);
   await writeAtomic(this.path(assetId),next);
   return next;
 }
 async apply(assetId,request={}){
   return this.store.withAssetWriteLock(assetId,()=>this.applyLocked(assetId,request));
 }
 async importPng(assetId,{expectedRevision,layerId,imageBase64,sourceLabel}={}){
  const current=await this.load(assetId);
  if(expectedRevision!==current.revision)throw Error('revision conflict: expected '+current.revision);
  const bytes=decodeImport(imageBase64,current.width,current.height);
  return this.apply(assetId,{expectedRevision,operations:[{
   type:'layer.import_png',layerId,pngBase64:imageBase64,
   sourceSha256:sha(bytes),sourceLabel,rightsVerified:false
  }]});
 }
 async restoreLocked(assetId,{expectedRevision,targetRevision}={}){
   const p=await this.load(assetId);
   if(expectedRevision!==p.revision)throw Error('revision conflict: expected '+p.revision);
   if(!Number.isSafeInteger(targetRevision)||targetRevision<0||targetRevision>=p.revision||p.revision>=MAX_REVISIONS)
    fail('invalid restore target');
   const next={...p,revision:p.revision+1,history:[...p.history,{operations:[{type:'restore',targetRevision}]}]};
   evaluated(next);
   await writeAtomic(this.path(assetId),next);
   return next;
 }
 async restore(assetId,request={}){
   return this.store.withAssetWriteLock(assetId,()=>this.restoreLocked(assetId,request));
 }
 async exportGodot(assetId,{expectedRevision}={}){
  return this.store.withAssetWriteLock(assetId,async()=>{
   const p=await this.load(assetId);
   if(p.revision!==expectedRevision)throw Error('revision conflict: expected '+p.revision);
   const {png,sha256}=renderPaint(p),dir=this.store.assetDir(assetId);
   const root=join(dir,'paint-exports');
   await mkdir(root,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e});
   const st=await lstat(root);
   if(!st.isDirectory()||st.isSymbolicLink())fail('unsafe export directory');
   const key=sha(Buffer.from(sha256+'|'+p.revision));
   const importedSources=p.history.flatMap(entry=>entry.operations)
    .filter(op=>op.type==='layer.import_png')
    .map(op=>({layerId:op.layerId,sourceSha256:op.sourceSha256,
      sourceLabel:op.sourceLabel,rightsVerified:false}));
   const target=join(root,key),files={
    'project.godot':'config_version=5\n\n[application]\nrun/main_scene="res://main.tscn"\n',
    'main.tscn':'[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Texture2D" path="res://art.png" id="1_art"]\n\n[node name="PaintPreview" type="Node2D"]\n\n[node name="Sprite2D" type="Sprite2D" parent="."]\ntexture = ExtResource("1_art")\n',
    'art.png':png,
    'evidence.json':JSON.stringify({assetId,revision:p.revision,pngSha256:sha256,
     importedSources,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false})+'\n'
   };
   const staging=await mkdtemp(join(root,'.stage-'));
   try{
    for(const [name,data]of Object.entries(files)){const h=await open(join(staging,name),'wx',0o600);try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
    try{await rename(staging,target)}
    catch(e){
     if(e.code!=='EEXIST'&&e.code!=='ENOTEMPTY')throw e;
     const directory=await lstat(target);
     if(!directory.isDirectory()||directory.isSymbolicLink())fail('unsafe existing export package');
     for(const [name,data]of Object.entries(files)){
      const previous=await readSafe(join(target,name),4*1024*1024);
      const desired=Buffer.isBuffer(data)?data:Buffer.from(data);
      if(!previous.equals(desired))fail('immutable export mismatch');
     }
    }
   }finally{await rm(staging,{recursive:true,force:true})}
   return {revision:p.revision,packageSha256:key,pngSha256:sha256,project:'assets/'+assetId+'/paint-exports/'+key,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false};
  });
 }
}
