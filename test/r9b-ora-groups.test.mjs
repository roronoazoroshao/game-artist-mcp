import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {writeOpenRaster,readOpenRaster} from '../src/ai-art/openraster.mjs';
import {readOraZip,writeOraZip} from '../src/ai-art/ora-zip.mjs';
const {PNG}=pngjs;
const solid=color=>{const p=new PNG({width:1,height:1,colorType:6});p.data.set(color);return PNG.sync.write(p)};
const layers=()=>[
 {id:'red',png:solid([255,0,0,255])},
 {id:'green',png:solid([0,255,0,255])},
 {id:'blue',png:solid([0,0,255,255])}
];
const group=()=>({type:'group',id:'root',children:[
 {type:'group',id:'effects',opacity:0.5,visible:true,isolation:'isolate',children:[
  {type:'layer',id:'red'},{type:'layer',id:'green'}]},
 {type:'layer',id:'blue'}
]});
const pixel=b=>[...PNG.sync.read(b,{checkCRC:true}).data.slice(0,4)];
const reject=f=>assert.throws(f,/R9B_|AI_PNG_REJECTED/);
test('R9b isolated nested group applies parent opacity only once and roundtrips editable tree',()=>{
 const bytes=writeOpenRaster({width:1,height:1,layers:layers(),stackTree:group()});
 const doc=readOpenRaster(bytes);
 assert.deepEqual(pixel(doc.mergedPng),[128,0,128,255]);
 assert.equal(doc.stackTree.children[0].id,'effects');
 assert.equal(doc.stackTree.children[0].opacity,0.5);
 assert.equal(doc.stackTree.children[0].isolation,'isolate');
 assert.deepEqual(doc.layers.map(l=>l.id),['red','green','blue']);
 assert.deepEqual(bytes,writeOpenRaster({width:1,height:1,layers:layers(),stackTree:group()}));
});
test('R9b hidden grouped artwork never leaks into composite, including within nested groups',()=>{
 const tree=group();tree.children[0].visible=false;
 const doc=readOpenRaster(writeOpenRaster({width:1,height:1,layers:layers(),stackTree:tree}));
 assert.deepEqual(pixel(doc.mergedPng),[0,0,255,255]);
 assert.equal(doc.stackTree.children[0].visible,false);
});
test('R9b rejects unknown blend/isolation, repeated references, excessive nesting and invalid root',()=>{
 const wrong=group();wrong.children[0].isolation='auto';
 reject(()=>writeOpenRaster({width:1,height:1,layers:layers(),stackTree:wrong}));
 const twice=group();twice.children[0].children.push({type:'layer',id:'red'});
 reject(()=>writeOpenRaster({width:1,height:1,layers:layers(),stackTree:twice}));
 const badMode=group();badMode.children[0].blendMode='svg:screen';
 reject(()=>writeOpenRaster({width:1,height:1,layers:layers(),stackTree:badMode}));
 let child={type:'layer',id:'red'};
 for(let i=0;i<6;i++)child={type:'group',id:'depth_'+i,children:[child]};
 const deep={type:'group',id:'root',children:[child,{type:'layer',id:'green'},{type:'layer',id:'blue'}]};
 reject(()=>writeOpenRaster({width:1,height:1,layers:layers(),stackTree:deep}));
});
test('R9b refuses malicious nested XML with external entities or unsupported group semantics',()=>{
 const bytes=writeOpenRaster({width:1,height:1,layers:layers(),stackTree:group()});
 const files=readOraZip(bytes);
 const mutate=replace=>writeOraZip([...files].map(([name,data])=>({name,bytes:
   name==='stack.xml'?Buffer.from(replace(data.toString('utf8')),'utf8'):data})));
 reject(()=>readOpenRaster(mutate(x=>x.replace('isolation="isolate"','isolation="auto"'))));
 reject(()=>readOpenRaster(mutate(x=>x.replace('<stack>','<!DOCTYPE image [ <!ENTITY evil SYSTEM "file:///etc/passwd"> ]><stack>'))));
 reject(()=>readOpenRaster(mutate(x=>x.replace('<stack>','<stack><stack name="x" opacity="0.5" foo="unknown"> </stack>'))));
});

test('R9b re-exports parsed nested ORA stack without dropping hierarchy or changing pixels',()=>{
 const original=writeOpenRaster({width:1,height:1,layers:layers(),stackTree:group()});
 const first=readOpenRaster(original);
 const exported=writeOpenRaster({width:first.width,height:first.height,
  layers:first.layers,stackTree:first.stackTree});
 const second=readOpenRaster(exported);
 assert.deepEqual(second.stackTree,first.stackTree);
 assert.deepEqual(pixel(second.mergedPng),pixel(first.mergedPng));
});

test('R9b rejects excessive isolated full-canvas group image memory before composing',()=>{
 const frameLayers=Array.from({length:6},(_,i)=>({
  id:'cell_'+i,png:solid([i,20,40,255])
 }));
 const stackTree={type:'group',id:'root',children:frameLayers.map((l,i)=>({
  type:'group',id:'group_'+i,opacity:1,visible:true,isolation:'isolate',
  children:[{type:'layer',id:l.id}]
 }))};
 reject(()=>writeOpenRaster({width:2048,height:2048,
  layers:frameLayers,stackTree}));
});
