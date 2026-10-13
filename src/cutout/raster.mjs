import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {renderSvg} from '../core/render-svg.mjs';
import {selectPartDocument} from './compile.mjs';
import pngjs from 'pngjs';
const {PNG}=pngjs;

const MAX_PNG=8*1024*1024;
const MAX_RAW=16*1024*1024;
const MAX_TOTAL_RAW=64*1024*1024;
const MAX_SVG=1024*1024;
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const color=/^#[0-9a-fA-F]{6}$/;
const digest=x=>createHash('sha256').update(x).digest('hex');
const safePaint=x=>x===undefined||x==='none'||(typeof x==='string'&&color.test(x));
function assertSafeNodes(document){
 for(const node of document.nodes){
  if(!safePaint(node.fill)||!safePaint(node.stroke))throw new Error('unsafe external paint URL or color');
  if(node.transform!==undefined)throw new Error('unsafe SVG transform');
  if(node.type==='path'&&typeof node.d==='string'&&!/^[\d.,+\-\seEmlhvcsqtazMLHVCSQTAZ]+$/.test(node.d))throw new Error('unsafe SVG path syntax');
 }
}
function boundedHeader(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<33||bytes.length>MAX_PNG)throw new Error('PNG budget exceeded');
 if(!bytes.subarray(0,8).equals(SIGNATURE))throw new Error('PNG signature invalid');
 if(bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw new Error('PNG IHDR header invalid');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>4096||height>4096||width*height*4>MAX_RAW)throw new Error('PNG IHDR raw image budget exceeded');
 if(bytes[24]!==8||bytes[25]!==6||bytes[28]!==0)throw new Error('unsupported PNG header colorType/bitDepth/interlace');
 return {width,height};
}
export function cropAlphaPng(png,{paddingPx=4}={}){
 if(!Number.isInteger(paddingPx)||paddingPx<0||paddingPx>8)throw new Error('PNG padding out of range');
 const header=boundedHeader(png);
 let img;
 try{img=PNG.sync.read(png,{checkCRC:true})}
 catch(e){throw new Error('PNG header/CRC/decode invalid')}
 if(img.width!==header.width||img.height!==header.height||img.data.length!==img.width*img.height*4)throw new Error('PNG decoded size mismatch');
 const {width:W,height:H}=img;
 let minX=W,minY=H,maxX=-1,maxY=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(img.data[(y*W+x)*4+3]!==0){
   minX=Math.min(minX,x);minY=Math.min(minY,y);
   maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
 }
 if(maxX<0)throw new Error('PNG has empty alpha');
 const contentRect={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
 const x0=Math.max(0,minX-paddingPx),y0=Math.max(0,minY-paddingPx);
 const x1=Math.min(W,maxX+1+paddingPx),y1=Math.min(H,maxY+1+paddingPx);
 const width=x1-x0,height=y1-y0;
 const pixels=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++){
  const from=((y+y0)*W+x0)*4;
  img.data.copy(pixels,y*width*4,from,from+width*4);
 }
 return {pixels,width,height,contentRect,sourceRect:{x:x0,y:y0,width,height},sourcePngSha256:digest(png)};
}
function defaultRasterizeSvg(svg){
 return execFileSync('rsvg-convert',['--format=png'],{
  input:svg,
  timeout:8000,
  maxBuffer:MAX_PNG,
  windowsHide:true,
  stdio:['pipe','pipe','pipe']
 });
}
export async function renderCutoutFrames(compiled,{rasterizeSvg=defaultRasterizeSvg}={}){
 if(!compiled||!Array.isArray(compiled.parts)||!compiled.manifest?.poseVariants)throw new Error('invalid compiled v2 cutout');
 if(typeof rasterizeSvg!=='function')throw new Error('missing rasterizer');
 const frames=[];let decoded=0;
 for(const part of [...compiled.parts].sort((a,b)=>a.id.localeCompare(b.id,'en'))){
  const poses=[null,...compiled.manifest.poseVariants.filter(p=>p.part===part.id).map(p=>p.id).sort()];
  for(const poseId of poses){
   const selected=selectPartDocument(compiled,part.id,poseId);
   assertSafeNodes(selected);
   const svg=renderSvg(selected);
   if(Buffer.byteLength(svg,'utf8')>MAX_SVG)throw new Error('SVG render budget exceeded');
   let rawPng;
   try{rawPng=await rasterizeSvg(svg)}catch(e){throw new Error('RASTERIZATION_FAILED: '+(e?.code??e?.message??'failed'))}
   const crop=cropAlphaPng(rawPng,{paddingPx:compiled.manifest.rendering.paddingPx});
   decoded+=crop.width*crop.height*4;
   if(decoded>MAX_TOTAL_RAW)throw new Error('total decoded PNG budget exceeded');
   frames.push({
    partId:part.id,poseId,sourceRevision:compiled.sourceRevision,
    sourceSha256:compiled.sourceSha256,
    sourceSvgSha256:digest(Buffer.from(svg,'utf8')),
    rawPng,crop,pivotSource:[...part.pivot]
   });
  }
 }
 return frames;
}
