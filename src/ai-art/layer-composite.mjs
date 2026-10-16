import pngjs from 'pngjs';
import {inspectAiPng} from './png-intake.mjs';
const {PNG}=pngjs;
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const fail=reason=>{throw new Error('R9B_INVALID_LAYER: '+reason)};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function unpack(png){
 const metadata=inspectAiPng(png);
 const decoded=PNG.sync.read(png,{checkCRC:true});
 return {...metadata,data:decoded.data};
}
export function validateLayerStack({width,height,layers}={}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
 width>4096||height>4096||width*height>4194304||!Array.isArray(layers)||
 layers.length<1||layers.length>24)fail('canvas or layer count out of range');
 const ids=new Set();let total=width*height*4;
 const checked=[];
 for(const layer of layers){
  if(!record(layer)||typeof layer.id!=='string'||!ID.test(layer.id)||ids.has(layer.id)||
    !Buffer.isBuffer(layer.png))fail('invalid/duplicate layer ID or PNG');
  for(const key of Object.keys(layer))
   if(!['id','png','x','y','opacity','visible'].includes(key))fail('unsupported layer property');
  ids.add(layer.id);
  const x=layer.x??0,y=layer.y??0,opacity=layer.opacity??1,visible=layer.visible??true;
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>4096||Math.abs(y)>4096||
    !Number.isFinite(opacity)||opacity<0||opacity>1||typeof visible!=='boolean')fail('offset/opacity/visibility');
  const im=unpack(layer.png);
  total+=im.width*im.height*4;
  if(total>64*1024*1024)fail('decoded aggregate budget');
  checked.push({id:layer.id,x,y,opacity,visible,png:Buffer.from(layer.png),width:im.width,height:im.height,data:im.data});
 }
 return checked;
}
export function composeLayers({width,height,layers}={}){
 const items=validateLayerStack({width,height,layers});
 const out=new PNG({width,height,colorType:6});out.data.fill(0);
 // ORA lists the topmost layer first, so composite from bottom to top.
 for(const layer of items.slice().reverse()){
  if(!layer.visible||layer.opacity===0)continue;
  for(let y=0;y<layer.height;y++){
   const py=y+layer.y;
   if(py<0||py>=height)continue;
   for(let x=0;x<layer.width;x++){
    const px=x+layer.x;
    if(px<0||px>=width)continue;
    const src=(y*layer.width+x)*4,dst=(py*width+px)*4;
    const sa=(layer.data[src+3]/255)*layer.opacity,da=out.data[dst+3]/255;
    const a=sa+da*(1-sa);
    if(a<=0)continue;
    for(let k=0;k<3;k++){
     const color=(layer.data[src+k]*sa+out.data[dst+k]*da*(1-sa))/a;
     out.data[dst+k]=Math.round(Math.min(255,Math.max(0,color)));
    }
    out.data[dst+3]=Math.round(a*255);
   }
  }
 }
 return PNG.sync.write(out);
}
export function applyAlphaMask(png,maskPng){
 let image,mask;
 try{image=unpack(png);mask=unpack(maskPng)}catch(e){fail('mask/image PNG rejected: '+e.message)}
 if(image.width!==mask.width||image.height!==mask.height)fail('mask dimensions mismatch');
 const out=new PNG({width:image.width,height:image.height,colorType:6});
 image.data.copy(out.data);
 for(let i=3;i<out.data.length;i+=4)out.data[i]=Math.round(out.data[i]*mask.data[i]/255);
 return PNG.sync.write(out);
}
