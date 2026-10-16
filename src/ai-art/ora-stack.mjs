import {composeLayers} from './layer-composite.mjs';

const fail=why=>{throw Error('R9B_STACK_REJECTED: '+why)};
const ID=/^[a-z][a-z0-9_]{0,63}$/;
const LAYER_PATH=/^data\/[a-z][a-z0-9_]{0,63}\.png$/;
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)}
function keys(x,allowed){
 if(!plain(x)||Object.keys(x).some(k=>!allowed.includes(k)))fail('unsupported tree attributes');
}
function opacity(x){
 if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)fail('opacity out of bounds');
 return x;
}
function normalizeLeaf(node,byId,seen){
 keys(node,['type','id']);
 if(node.type!=='layer'||!ID.test(node.id)||!byId.has(node.id)||
 seen.has(node.id))fail('unknown or duplicate layer reference');
 seen.add(node.id);
 return Object.freeze({type:'layer',id:node.id});
}
export function assertStackTree(tree,layers){
 if(!Array.isArray(layers)||layers.length<1||layers.length>24)fail('layer count');
 const byId=new Map(layers.map(l=>[l.id,l]));
 const seen=new Set(),groups=new Set();let groupCount=0;
 function visit(node,depth,root=false){
  if(!plain(node))fail('invalid tree element');
  if(node.type==='layer'){
   if(root)fail('root must be stack');
   return normalizeLeaf(node,byId,seen);
  }
  keys(node,['type','id','children','opacity','visible','isolation','blendMode']);
  if(root&&((node.opacity!==undefined&&node.opacity!==1)||
    (node.visible!==undefined&&node.visible!==true)||
    (node.isolation!==undefined&&node.isolation!=='isolate')||
    node.blendMode!==undefined))fail('root XML group attributes cannot change');
  if(node.type!=='group'||!ID.test(node.id)||!Array.isArray(node.children)||
  node.children.length<1||node.children.length>24||depth>4||
  groups.has(node.id)||byId.has(node.id)||(!root&&node.id==='root'))
   fail('malformed group tree/depth');
  groups.add(node.id);groupCount++;
  if(groupCount>24)fail('group budget exceeded');
  if(root&&node.id!=='root')fail('root group ID must be root');
  if(!root&&(node.isolation??'isolate')!=='isolate')fail('non-isolated groups unsupported');
  if(!root&&(node.blendMode??'svg:src-over')!=='svg:src-over')fail('unsupported group blend');
  const normalized={
   type:'group',id:node.id,opacity:root?1:opacity(node.opacity??1),
   visible:root?true:(node.visible??true),isolation:'isolate',
   children:node.children.map(child=>visit(child,depth+1))
  };
  if(typeof normalized.visible!=='boolean')fail('invalid group visibility');
  return normalized;
 }
 const normalized=visit(tree,0,true);
 const ordered=[];
 function flatten(node){if(node.type==='layer')ordered.push(node.id);
 else for(const c of node.children)flatten(c)}
 flatten(normalized);
 if(!same(ordered,layers.map(l=>l.id)))fail('stack order must match top-first layer list');
 return normalized;
}
const attr=(s,allow)=>{
 if(typeof s!=='string'||s.length>2048||/[<&]/.test(s))fail('unsafe XML attributes');
 const out={};const rest=s.replace(/([a-z-]+)="([^"]*)"/g,(_m,k,v)=>{
  if(!allow.includes(k)||Object.hasOwn(out,k))fail('unknown/duplicate XML attribute');
  out[k]=v;return '';
 });
 if(rest.trim()!=='')fail('invalid XML attributes');
 return out;
};
function groupAttrs(a){
 const v=(x)=>{if(x===undefined)return 1;const n=Number(x);
 if(!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(x)||!Number.isFinite(n))fail('group opacity');
 return opacity(n)};
 if((a.isolation??'isolate')!=='isolate'||(a['composite-op']??'svg:src-over')!=='svg:src-over')
  fail('unsupported XML group rendering');
 if(!['visible','hidden'].includes(a.visibility??'visible'))fail('group visibility');
 return {opacity:v(a.opacity),visible:(a.visibility??'visible')==='visible',isolation:'isolate'};
}
function layerFromXml(a){
 if(!LAYER_PATH.test(a.src??''))fail('unsafe XML layer src');
 const id=a.name??a.src.slice(5,-4);
 if(!ID.test(id)||(a['composite-op']??'svg:src-over')!=='svg:src-over')
  fail('layer ID/blending');
 const x=Number(a.x??0),y=Number(a.y??0),o=Number(a.opacity??1);
 if(!/^-?\d+$/.test(a.x??'0')||!/^-?\d+$/.test(a.y??'0')||
 !Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>4096||Math.abs(y)>4096||
 !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(a.opacity??'1')||
 !['visible','hidden'].includes(a.visibility??'visible'))fail('XML layer geometry');
 return {id,src:a.src,x,y,opacity:opacity(o),visible:(a.visibility??'visible')==='visible'};
}
/**
 * Token-only subset XML parser: no processing instructions except fixed prolog,
 * no DTD/entities, CDATA, comments, network, or non-whitespace character data.
 */
export function parseGroupStack(xml){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>65536||
 /<!|&|\x00/.test(xml))fail('unsafe XML entities/markup');
 const input=xml.replace(/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*/,'').trim();
 if(input.includes('<?'))fail('unsupported XML PI');
 const matches=[...input.matchAll(/<[^>]*>/g)];let offset=0;
 let image=null,root=null,ended=false;const open=[],layers=[],seenIds=new Set(),seenSources=new Set();
 for(const m of matches){
  if(input.slice(offset,m.index).trim()!=='')fail('unexpected XML character data');
  offset=m.index+m[0].length;
  const t=m[0];
  if(t.startsWith('<image ')&&t.endsWith('>')&&!image&&!root&&!ended){
   const a=attr(t.slice(6,-1),['w','h','name','version']);
   const w=Number(a.w),h=Number(a.h);
   if(!/^\d+$/.test(a.w??'')||!/^\d+$/.test(a.h??'')||
   !Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||
   w>4096||h>4096||w*h>4194304||
   (a.version!==undefined&&!['0.0.3','0.0.6'].includes(a.version)))
    fail('XML image header');
   image={width:w,height:h};continue;
  }
  if(t==='<stack>'&&image&&!ended){
   if(root||open.length)fail('nested anonymous stack unsupported');
   root={type:'group',id:'root',children:[]};open.push(root);continue;
  }
  if(t.startsWith('<stack ')&&t.endsWith('>')&&image&&!ended&&open.length){
   if(open.length>4)fail('XML nesting budget');
   const a=attr(t.slice(6,-1),['name','opacity','visibility','composite-op','isolation']);
   if(!ID.test(a.name??'')||a.name==='root')fail('XML group identity');
   const node={type:'group',id:a.name,...groupAttrs(a),children:[]};
   open[open.length-1].children.push(node);open.push(node);continue;
  }
  if(t.startsWith('<layer ')&&t.endsWith('/>')&&image&&!ended&&open.length){
   const a=attr(t.slice(6,-2),['name','src','x','y','opacity','visibility','composite-op']);
   const l=layerFromXml(a);
   if(seenIds.has(l.id)||seenSources.has(l.src)||layers.length>=24)
    fail('duplicate/excess layer');
   seenIds.add(l.id);seenSources.add(l.src);
   layers.push(l);open[open.length-1].children.push({type:'layer',id:l.id});continue;
  }
  if(t==='</stack>'&&open.length){open.pop();continue}
  if(t==='</image>'&&image&&root&&open.length===0&&!ended){ended=true;continue}
  fail('invalid/unbalanced XML element');
 }
 if(offset!==input.length||!ended||!root||open.length||
 layers.length<1)fail('truncated/unknown XML tree');
 const normalized=assertStackTree(root,layers);
 return {...image,layers,stackTree:normalized};
}
export function serializeGroupStack(width,height,tree,layers){
 const byId=new Map(layers.map(l=>[l.id,l]));
 const header='<?xml version="1.0" encoding="UTF-8"?>\n'+
 '<image w="'+width+'" h="'+height+'" name="Spirit Lantern" version="0.0.6">\n';
 function render(node,depth){
  const ind='  '.repeat(depth);
  if(node.type==='layer'){
   const l=byId.get(node.id);
   return ind+'<layer name="'+l.id+'" src="data/'+l.id+'.png" x="'+l.x+
   '" y="'+l.y+'" opacity="'+l.opacity+'" visibility="'+(l.visible?'visible':'hidden')+
   '" composite-op="svg:src-over"/>';
  }
  const root=node.id==='root';
  const open=root?'<stack>':'<stack name="'+node.id+'" opacity="'+node.opacity+
   '" visibility="'+(node.visible?'visible':'hidden')+
   '" composite-op="svg:src-over" isolation="isolate">';
  return ind+open+'\n'+node.children.map(c=>render(c,depth+1)).join('\n')+
  '\n'+ind+'</stack>';
 }
 return header+render(tree,0)+'\n</image>\n';
}
export function composeGroupTree({width,height,layers,stackTree}){
 const byId=new Map(layers.map(l=>[l.id,l]));
 function render(node){
  const items=node.children.map(child=>{
   if(child.type==='layer')return byId.get(child.id);
   return {id:child.id,png:render(child),x:0,y:0,
    opacity:child.opacity,visible:child.visible};
  });
  return composeLayers({width,height,layers:items});
 }
 return render(stackTree);
}
