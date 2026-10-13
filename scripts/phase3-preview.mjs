import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import pngjs from 'pngjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {auditLoop} from '../src/cutout/animation.mjs';
import {renderCutoutPreview} from '../src/cutout/preview.mjs';
const {PNG}=pngjs;
const root=resolve(new URL('..',import.meta.url).pathname);
const doc=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/source.json'),'utf8'));
const cut=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/cutout.json'),'utf8'));
const compiled=compileCutout(doc,cut,{revision:1});
const qa=auditLoop(compiled,'idle');
assert.equal(qa.ok,true,qa.errors.join('; '));
const output=join(root,'examples/spirit-lantern/generated/phase3-review');
await mkdir(output,{recursive:true,mode:0o700});
const sha=x=>createHash('sha256').update(x).digest('hex');
function resize(buffer,width){
 const src=PNG.sync.read(buffer),height=Math.round(src.height*width/src.width);
 const target=new PNG({width,height,colorType:6});
 const w=src.width,h=src.height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=(x+.5)*w/width-.5,py=(y+.5)*h/height-.5;
  const x0=Math.max(0,Math.min(w-1,Math.floor(px))),y0=Math.max(0,Math.min(h-1,Math.floor(py)));
  const x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
  const dx=Math.max(0,Math.min(1,px-x0)),dy=Math.max(0,Math.min(1,py-y0));
  const coords=[[x0,y0,(1-dx)*(1-dy)],[x1,y0,dx*(1-dy)],[x0,y1,(1-dx)*dy],[x1,y1,dx*dy]];
  let a=0,r=0,g=0,b=0;
  for(const [u,v,k] of coords){
   const p=(v*w+u)*4,t=src.data[p+3]/255*k;a+=t;r+=src.data[p]*t;g+=src.data[p+1]*t;b+=src.data[p+2]*t;
  }
  const p=(y*width+x)*4;
  target.data[p]=a?Math.round(r/a):0;
  target.data[p+1]=a?Math.round(g/a):0;
  target.data[p+2]=a?Math.round(b/a):0;
  target.data[p+3]=Math.round(a*255);
 }
 return PNG.sync.write(target);
}
const times=[0,.125,.25,.375,.5,.75,1.25,1.875],report=[];
const columns=4,tileW=128,tileH=160;
const sheet=new PNG({width:columns*tileW,height:2*tileH,colorType:6});sheet.data.fill(0);
for(let i=0;i<times.length;i++){
 const timeSeconds=times[i],frame=await renderCutoutPreview({compiled,clipId:'idle',timeSeconds});
 const at128=resize(frame.png,128),at64=resize(frame.png,64);
 const label=String(i).padStart(2,'0');
 await writeFile(join(output,'frame-'+label+'-128.png'),at128);
 await writeFile(join(output,'frame-'+label+'-64.png'),at64);
 const p=PNG.sync.read(at128),ox=(i%4)*tileW,oy=Math.floor(i/4)*tileH;
 for(let y=0;y<tileH;y++)p.data.copy(sheet.data,((oy+y)*sheet.width+ox)*4,y*tileW*4,(y+1)*tileW*4);
 report.push({timeSeconds,pose:frame.frame.parts.flame.poseId,sha256:sha(frame.png),at64Sha256:sha(at64),at128Sha256:sha(at128)});
}
await writeFile(join(output,'contact-sheet.png'),PNG.sync.write(sheet));
await writeFile(join(output,'report.json'),JSON.stringify({
 sourceSha256:compiled.sourceSha256,sourceRevision:1,manifestSha256:compiled.manifestSha256,
 animatorQa:qa,reviewStatus:'UNSCORED_AI_SELF_REVIEW',frames:report
},null,2)+'\n');
assert.equal(new Set(report.slice(0,4).map(x=>x.pose)).size,4);
console.log(JSON.stringify({ok:true,frames:report.length,output:'examples/spirit-lantern/generated/phase3-review',reviewStatus:'UNSCORED_AI_SELF_REVIEW'}));
