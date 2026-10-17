import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {readOpenRaster} from './openraster.mjs';
import {downsampleStraightAlpha} from './raster-frame-provider.mjs';

const {PNG}=pngjs;
const fail=why=>{throw Error('R9D_DEPTH_REJECTED: '+why)};
const hash=x=>createHash('sha256').update(x).digest('hex');

// Hand-authored, intentionally conservative, based on the *original* body
// paint viewed in world-space at master 1024x1280, not on generated vector art.
// This is a derived technical visibility guide, NOT Adobe-painted source or a
// native Krita/GIMP mask. Coordinates belong to the R9d master only.
const POLYGON=Object.freeze([
 Object.freeze([480,532]),Object.freeze([507,532]),
 Object.freeze([510,840]),Object.freeze([508,908]),
 Object.freeze([475,910]),Object.freeze([472,830]),
 Object.freeze([472,595])
]);
const intersects=(y)=>{
 const xs=[];
 for(let i=0;i<POLYGON.length;i++){
  const a=POLYGON[i],b=POLYGON[(i+1)%POLYGON.length];
  if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))
   xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
 }
 if(xs.length!==2)return null;
 return [Math.min(...xs),Math.max(...xs)];
};
/**
 * Draw only the real forward-facing bronze center rail as a new, separately
 * editable Godot foreground overlay. Keep all eight input source PNGs and
 * the original Firefly master ORA bytes exactly unchanged.
 *
 * No fantasy "segmentation AI" attestation: this polygon needs visual review.
 */
export function deriveR9dFrontCageRail({ora,expectedOraSha256=null}={}){
 if(!Buffer.isBuffer(ora)||(expectedOraSha256!==null&&
    (!/^[0-9a-f]{64}$/.test(expectedOraSha256)||hash(ora)!==expectedOraSha256)))
  fail('invalid master ORA or immutable SHA256');
 let doc;
 try{doc=readOpenRaster(ora)}catch(e){fail('invalid OpenRaster source: '+String(e?.message??e).slice(0,140))}
 if(doc.width!==1024||doc.height!==1280||doc.layers.length!==8||
    doc.layers[0]?.id!=='body_base')fail('unexpected original R9d layer contract');
 const body=doc.layers[0],flame=doc.layers.find(l=>l.id==='flame_flame_a');
 if(!flame||!body||body.visible!==true)fail('no original body/flame source');
 const im=PNG.sync.read(body.png,{checkCRC:true});
 const fire=PNG.sync.read(flame.png,{checkCRC:true});
 const result=new PNG({width:1024,height:1280,colorType:6});
 let visibleRailPixels=0,railOverFlamePixels=0;
 for(let y=530;y<=912;y++){
  const span=intersects(y+0.5);
  if(!span)continue;
  for(let x=Math.max(0,Math.floor(span[0])-1);x<=Math.min(1023,Math.ceil(span[1])+1);x++){
   // 1px feather at rail's authored boundary. The opaque interior RGB is
   // copied exactly from Adobe-painted original, without recoloring.
   const coverage=Math.max(0,Math.min(1,x+1-span[0],span[1]-x));
   if(coverage<=0)continue;
   const bx=x-body.x,by=y-body.y;
   if(bx<0||by<0||bx>=im.width||by>=im.height)continue;
   const src=4*(by*im.width+bx),dst=4*(y*1024+x);
   const alpha=Math.round(im.data[src+3]*coverage);
   if(!alpha)continue;
   for(let k=0;k<3;k++)result.data[dst+k]=im.data[src+k];
   result.data[dst+3]=alpha;
   if(alpha>=96)visibleRailPixels++;
   const fx=x-flame.x,fy=y-flame.y;
   if(fx>=0&&fy>=0&&fx<fire.width&&fy<fire.height&&
      fire.data[4*(fy*fire.width+fx)+3]>=96&&alpha>=96)
     railOverFlamePixels++;
  }
 }
 if(visibleRailPixels<2000||railOverFlamePixels<100)
  fail('authored foreground mask does not cover the real metal/flame crossing');
 const masterPng=PNG.sync.write(result);
 const runtimePng=downsampleStraightAlpha(masterPng,4);
 return Object.freeze({
  masterPng,runtimePng,
  sourceOraSha256:hash(ora),sourceBodySha256:hash(body.png),
  overlaySha256:hash(runtimePng),
  polygon:POLYGON,maskType:'AUTHORED_CONSERVATIVE_FRONT_RAIL',
  visibleRailPixels,railOverFlamePixels,
  sourceOriginalUnchanged:true,providerOriginalAttested:false,
  artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false
 });
}
