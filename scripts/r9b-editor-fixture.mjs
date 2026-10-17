import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import pngjs from 'pngjs';
import {writeOpenRaster,readOpenRaster} from '../src/ai-art/openraster.mjs';

const {PNG}=pngjs;
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
function painted(width,height,paint){
 const p=new PNG({width,height,colorType:6});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)
  p.data.set(paint(x,y),4*(y*width+x));
 return PNG.sync.write(p);
}
/**
 * Synthetic colors are intentional test patterns, not generated game art.
 * Small canvas allows validation against real Krita with low CI cost.
 */
export function buildEditorInteropFixture(){
 const layers=[
  {id:'glow',png:painted(20,20,(x,y)=>
   [240,160,20,Math.max(0,200-Math.round(Math.hypot(x-10,y-10)*16))]),
   x:10,y:4,opacity:0.75,visible:true},
  {id:'paint',png:painted(24,24,(x,y)=>[28,94,184,(x+y)%2?255:160]),
   x:6,y:9,opacity:1,visible:true},
  {id:'hidden',png:painted(10,10,()=>[230,20,200,255]),
   x:35,y:38,opacity:1,visible:true}
 ];
 const stackTree={type:'group',id:'root',children:[
  {type:'group',id:'materials',opacity:1,visible:true,isolation:'isolate',
   children:[{type:'layer',id:'glow'},{type:'layer',id:'paint'}]},
  {type:'group',id:'alternatives',opacity:1,visible:false,isolation:'isolate',
   children:[{type:'layer',id:'hidden'}]}
 ]};
 const ora=writeOpenRaster({width:64,height:64,layers,stackTree});
 const checked=readOpenRaster(ora);
 return {ora,evidence:{
  origin:'SYNTHETIC_INTEROP_FIXTURE_NOT_ART',artisticReview:'UNSCORED',
  commercialRightsCleared:false,canvas:[64,64],layerCount:3,
  oraSha256:sha(ora),mergedPngSha256:sha(checked.mergedPng),
  note:'Only tests interoperability; no authenticated model art or licensed production output.'
 }};
}
if(process.argv[1]&&process.argv[1].endsWith('r9b-editor-fixture.mjs')){
 const out=resolve(process.argv[2]??'examples/spirit-lantern/generated/r9b-editor-interop');
 const {ora,evidence}=buildEditorInteropFixture();
 await mkdir(out,{recursive:true,mode:0o700});
 await writeFile(join(out,'source.ora'),ora);
 await writeFile(join(out,'source-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log('R9B_SYNTHETIC_EDITOR_SOURCE_CREATED');
 console.log(JSON.stringify(evidence));
}
