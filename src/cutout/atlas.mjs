import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const sha=x=>createHash('sha256').update(x).digest('hex');
const id=/^[a-z][a-z0-9_]{0,63}$/;
const nextPow2=n=>2**Math.ceil(Math.log2(Math.max(1,n)));
const compare=(a,b)=>a<b?-1:a>b?1:0;
const overlaps=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
function checkedFrames(frames,padding,maxAtlasSize){
 if(!Array.isArray(frames)||!frames.length||frames.length>80)throw new Error('ATLAS_OVERFLOW: frame count');
 if(!Number.isInteger(maxAtlasSize)||maxAtlasSize<64||maxAtlasSize>2048||!Number.isInteger(padding)||padding<2||padding>8)
  throw new Error('ATLAS_OVERFLOW: atlas size or padding');
 const seen=new Set();let sourceSha=null,sourceRevision=null;
 for(const f of frames){
  if(!f||!id.test(String(f.partId??''))||(f.poseId!==null&&f.poseId!==undefined&&!id.test(f.poseId)))throw new Error('invalid atlas frame ID');
  const key=f.partId+'/'+(f.poseId??'base');
  if(seen.has(key))throw new Error('duplicate atlas frame identity');
  seen.add(key);
  const c=f.crop,rect=c?.sourceRect;
  if(!c||!Buffer.isBuffer(c.pixels)||!Number.isSafeInteger(c.width)||!Number.isSafeInteger(c.height)||
   c.width<1||c.height<1||c.width*c.height*4!==c.pixels.length||!rect||
   rect.width!==c.width||rect.height!==c.height||![rect.x,rect.y].every(x=>Number.isSafeInteger(x)&&x>=0))throw new Error('invalid atlas crop bounds');
  if(!Array.isArray(f.pivotSource)||f.pivotSource.length!==2||f.pivotSource.some(x=>!Number.isFinite(x)))throw new Error('invalid atlas pivot');
  if(sourceSha===null){sourceSha=f.sourceSha256;sourceRevision=f.sourceRevision}
  else if(sourceSha!==f.sourceSha256||sourceRevision!==f.sourceRevision)throw new Error('source revision/hash mismatch across atlas frames');
 }
 return [...frames].sort((a,b)=>compare(a.partId,b.partId)||compare(a.poseId??'',b.poseId??''));
}
function layout(frames,width,pad,maxAtlasSize){
 let x=pad,y=pad,shelf=0;
 const placements=[];
 for(const f of frames){
  const w=f.crop.width,h=f.crop.height;
  if(w+2*pad>width||h+2*pad>maxAtlasSize)return null;
  if(x+w+pad>width){y+=shelf+pad;x=pad;shelf=0}
  if(y+h+pad>maxAtlasSize)return null;
  placements.push({frame:f,x,y,width:w,height:h});
  x+=w+pad;shelf=Math.max(shelf,h);
 }
 const height=nextPow2(y+shelf+pad);
 return height>maxAtlasSize?null:{width,height,placements};
}
export function packAtlas(frames,{maxAtlasSize=2048,paddingPx=4}={}){
 const ordered=checkedFrames(frames,paddingPx,maxAtlasSize);
 const widest=Math.max(...ordered.map(f=>f.crop.width+paddingPx*2));
 let best=null;
 for(let w=nextPow2(widest);w<=maxAtlasSize;w*=2){
  const candidate=layout(ordered,w,paddingPx,maxAtlasSize);
  if(candidate&&(!best||candidate.width*candidate.height<best.width*best.height))best=candidate;
 }
 if(!best)throw new Error('ATLAS_OVERFLOW: parts do not fit bounded atlas');
 if(best.width*best.height*4>16*1024*1024)throw new Error('ATLAS_OVERFLOW: RGBA memory budget');
 const atlas=new PNG({width:best.width,height:best.height,colorType:6});atlas.data.fill(0);
 const regions=[];
 for(const p of best.placements){
  const f=p.frame,c=f.crop;
  for(let y=0;y<c.height;y++){
   const offset=(p.y+y)*best.width*4+p.x*4;
   c.pixels.copy(atlas.data,offset,y*c.width*4,(y+1)*c.width*4);
  }
  const src=c.sourceRect;
  const cropCenter=[src.x+c.width/2,src.y+c.height/2];
  const localSpriteOffset=[cropCenter[0]-f.pivotSource[0],cropCenter[1]-f.pivotSource[1]];
  regions.push({
   partId:f.partId,poseId:f.poseId??null,
   pixelRect:{x:src.x,y:src.y,width:src.width,height:src.height},
   contentRect:{...c.contentRect},
   textureRect:{x:p.x,y:p.y,width:c.width,height:c.height},
   cropCenter,pivotSource:[...f.pivotSource],localSpriteOffset,
   sourceSvgSha256:f.sourceSvgSha256,
   sourcePngSha256:c.sourcePngSha256
  });
 }
 const png=PNG.sync.write(atlas);
 return {png,atlasWidth:best.width,atlasHeight:best.height,paddingPx,regions,sourceSha256:ordered[0].sourceSha256,sourceRevision:ordered[0].sourceRevision,atlasSha256:sha(png)};
}
export function verifyAtlas(pkg){
 const errors=[];
 try{
  if(!pkg||!Buffer.isBuffer(pkg.png)||!Number.isSafeInteger(pkg.atlasWidth)||!Number.isSafeInteger(pkg.atlasHeight)||
    pkg.atlasWidth>2048||pkg.atlasHeight>2048||pkg.atlasWidth<1||pkg.atlasHeight<1)throw new Error('invalid atlas header');
  if(pkg.png.length<33||pkg.png.readUInt32BE(16)!==pkg.atlasWidth||pkg.png.readUInt32BE(20)!==pkg.atlasHeight||sha(pkg.png)!==pkg.atlasSha256)throw new Error('invalid atlas PNG dimensions or hash');
  if(!Array.isArray(pkg.regions)||!pkg.regions.length)throw new Error('invalid atlas regions');
  const ids=new Set();
  for(let i=0;i<pkg.regions.length;i++){
   const region=pkg.regions[i],p=region.textureRect;
   if(!p||![p.x,p.y,p.width,p.height].every(Number.isSafeInteger)||p.x<0||p.y<0||p.width<=0||p.height<=0||
    p.x+p.width>pkg.atlasWidth||p.y+p.height>pkg.atlasHeight)errors.push('atlas region out of bounds');
   const k=region.partId+'/'+(region.poseId??'base');if(ids.has(k))errors.push('duplicate atlas region');ids.add(k);
   for(let j=0;j<i;j++)if(overlaps(p,pkg.regions[j].textureRect))errors.push('atlas region overlap');
   const c=region.pixelRect,center=region.cropCenter;
   if(!c||!Number.isFinite(center?.[0])||!Number.isFinite(center?.[1])||
      !Array.isArray(region.localSpriteOffset)||region.localSpriteOffset.length!==2||
      Math.abs(region.localSpriteOffset[0]-(center[0]-region.pivotSource[0]))>0.0001||
      Math.abs(region.localSpriteOffset[1]-(center[1]-region.pivotSource[1]))>0.0001)errors.push('atlas pivot mismatch');
  }
 }catch(e){errors.push('invalid atlas: '+String(e?.message??e))}
 return {ok:errors.length===0,errors};
}
