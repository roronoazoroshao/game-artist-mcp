import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {composeLayers,validateLayerStack} from './layer-composite.mjs';
import {inspectAiPng} from './png-intake.mjs';
import {readOraZip,writeOraZip} from './ora-zip.mjs';
import {assertStackTree,serializeGroupStack,parseGroupStack,composeGroupTree} from './ora-stack.mjs';
const {PNG}=pngjs;
const fail=why=>{throw new Error('R9B_ORA_REJECTED: '+why)};
const asciiId=/^[a-z][a-z0-9_]{0,63}$/;
const sha=buf=>createHash('sha256').update(buf).digest('hex');
function parseAttributes(raw,allowed){
 if(typeof raw!=='string'||raw.length>2048||raw.includes('&')||raw.includes('<'))fail('unsafe XML attributes');
 const attributes={};
 const rest=raw.replace(/([a-z-]+)="([^"]*)"/g,(_match,key,value)=>{
  if(!allowed.includes(key)||Object.hasOwn(attributes,key))fail('unknown/duplicate XML attribute');
  attributes[key]=value;
  return '';
 });
 if(rest.trim()!=='')fail('invalid XML attribute syntax');
 return attributes;
}
function xmlLayer(layer){
 return '  <layer name="'+layer.id+'" src="data/'+layer.id+'.png" x="'+layer.x+
 '" y="'+layer.y+'" opacity="'+layer.opacity+'" visibility="'+(layer.visible?'visible':'hidden')+
 '" composite-op="svg:src-over"/>';
}
function xmlStack(width,height,layers){
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<image w="'+width+'" h="'+height+'" name="Spirit Lantern" version="0.0.6">\n'+
  '<stack>\n'+layers.map(xmlLayer).join('\n')+'\n</stack>\n</image>\n';
}
function makeThumbnail(input){
 const image=PNG.sync.read(input,{checkCRC:true});
 const ratio=Math.min(1,256/Math.max(image.width,image.height));
 const width=Math.max(1,Math.round(image.width*ratio));
 const height=Math.max(1,Math.round(image.height*ratio));
 const thumb=new PNG({width,height,colorType:6});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const sx=Math.min(image.width-1,Math.floor((x+0.5)*image.width/width));
  const sy=Math.min(image.height-1,Math.floor((y+0.5)*image.height/height));
  image.data.copy(thumb.data,(y*width+x)*4,(sy*image.width+sx)*4,(sy*image.width+sx+1)*4);
 }
 return PNG.sync.write(thumb);
}
function readStack(xml){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>65536||/<!|&|\x00/.test(xml))fail('unsafe XML markup/entities');
 const clean=xml.replace(/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*/,'').trim();
 if(clean.includes('<?'))fail('unsupported XML processing instruction');
 const root=clean.match(/^<image\s+([^>]+)>\s*<stack>\s*([\s\S]*?)\s*<\/stack>\s*<\/image>$/);
 if(!root)fail('only a flat baseline OpenRaster stack supported');
 const image=parseAttributes(root[1],['w','h','name','version']);
 const width=Number(image.w),height=Number(image.h);
 if(!/^\d+$/.test(image.w??'')||!/^\d+$/.test(image.h??'')||
 !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
 width>4096||height>4096||width*height>4194304||
 (image.version!==undefined&&!['0.0.3','0.0.6'].includes(image.version)))fail('invalid XML image header');
 const found=[...root[2].matchAll(/<layer\s+([^>]+)\/>/g)];
 if(found.length<1||found.length>24||root[2].replace(/<layer\s+([^>]+)\/>/g,'').trim()!=='')fail('unsupported nonflat/malformed layer entries');
 const ids=new Set(),paths=new Set();
 const layers=found.map(match=>{
  const a=parseAttributes(match[1],['name','src','x','y','opacity','visibility','composite-op']);
  if(!/^data\/[a-z][a-z0-9_]{0,63}\.png$/.test(a.src??''))fail('unsafe layer path');
  const id=a.name??a.src.slice(5,-4);
  if(!asciiId.test(id)||ids.has(id)||paths.has(a.src))fail('duplicate/invalid layer identity');
  ids.add(id);paths.add(a.src);
  if((a['composite-op']??'svg:src-over')!=='svg:src-over')fail('unsupported blending mode');
  const x=Number(a.x??0),y=Number(a.y??0),opacity=Number(a.opacity??1);
  if(!/^-?\d+$/.test(a.x??'0')||!/^-?\d+$/.test(a.y??'0')||
 !Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>4096||Math.abs(y)>4096||
 !Number.isFinite(opacity)||opacity<0||opacity>1||
 !['visible','hidden'].includes(a.visibility??'visible'))fail('unsupported layer geometry/visibility');
  return {id,src:a.src,x,y,opacity,visible:(a.visibility??'visible')==='visible'};
 });
 return {width,height,layers};
}
export function writeOpenRaster({width,height,layers,stackTree}={}){
 const prepared=validateLayerStack({width,height,layers});
 const compositing=prepared.map(x=>({id:x.id,png:x.png,x:x.x,y:x.y,opacity:x.opacity,visible:x.visible}));
 const tree=stackTree===undefined?null:assertStackTree(stackTree,compositing);
 const merged=tree?composeGroupTree({width,height,layers:compositing,stackTree:tree}):
  composeLayers({width,height,layers:compositing});
 const thumbnail=makeThumbnail(merged);
 const xml=Buffer.from(tree?serializeGroupStack(width,height,tree,compositing):
  xmlStack(width,height,compositing),'utf8');
 const entries=[{name:'mimetype',bytes:Buffer.from('image/openraster','utf8')},
  {name:'stack.xml',bytes:xml},
  ...prepared.map(layer=>({name:'data/'+layer.id+'.png',bytes:layer.png})),
  {name:'mergedimage.png',bytes:merged},
  {name:'Thumbnails/thumbnail.png',bytes:thumbnail}
 ];
 return writeOraZip(entries);
}
export function readOpenRaster(bytes){
 const files=readOraZip(bytes);
 for(const mandatory of ['mimetype','stack.xml','mergedimage.png','Thumbnails/thumbnail.png'])
  if(!files.has(mandatory))fail('missing required OpenRaster entry '+mandatory);
 const xml=files.get('stack.xml').toString('utf8');
 const stack=/<stack\s+/.test(xml)?parseGroupStack(xml):readStack(xml);
 const layers=stack.layers.map(layer=>{
  const png=files.get(layer.src);
  if(!png)fail('missing layer PNG');
  inspectAiPng(png);
  const {src,...data}=layer;
  return {...data,png:Buffer.from(png)};
 });
 if([...files.keys()].filter(x=>x.startsWith('data/')).length!==layers.length)fail('orphaned layer data');
 const merged=files.get('mergedimage.png'),thumbnail=files.get('Thumbnails/thumbnail.png');
 const m=inspectAiPng(merged),t=inspectAiPng(thumbnail);
 if(m.width!==stack.width||m.height!==stack.height||t.width>256||t.height>256)fail('merged image/thumbnail dimensions');
 const computed=stack.stackTree?
  composeGroupTree({width:stack.width,height:stack.height,layers,stackTree:stack.stackTree}):
  composeLayers({width:stack.width,height:stack.height,layers});
 const expected=PNG.sync.read(computed,{checkCRC:true}),actual=PNG.sync.read(merged,{checkCRC:true});
 if(!expected.data.equals(actual.data))fail('mergedimage.png contradicts editable layer stack');
 return Object.freeze({width:stack.width,height:stack.height,layers,mergedPng:Buffer.from(merged),
  thumbnailPng:Buffer.from(thumbnail),sha256:sha(bytes),
  stackTree:stack.stackTree??{type:'group',id:'root',
   children:layers.map(layer=>({type:'layer',id:layer.id}))}});
}
