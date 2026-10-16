import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {composeLayers,applyAlphaMask} from '../src/ai-art/layer-composite.mjs';
const {PNG}=pngjs;
function src(w,h,rgba){const p=new PNG({width:w,height:h,colorType:6});for(let i=0;i<p.data.length;i+=4)p.data.set(rgba,i);return PNG.sync.write(p)}
const pixel=(buf,x=0,y=0)=>{const p=PNG.sync.read(buf,{checkCRC:true});return [...p.data.subarray((y*p.width+x)*4,(y*p.width+x+1)*4)]};
const red=()=>src(1,1,[255,0,0,128]),blue=()=>src(2,2,[0,0,255,255]);
test('R9b painterly layer compositor respects OpenRaster top-first order and straight alpha',()=>{
 const r=composeLayers({width:2,height:2,layers:[{id:'red',png:red(),x:0,y:0,opacity:1,visible:true},{id:'blue',png:blue()}]});
 assert.deepEqual(pixel(r,0,0),[128,0,127,255]);assert.deepEqual(pixel(r,1,0),[0,0,255,255]);
 const inverse=composeLayers({width:2,height:2,layers:[{id:'blue',png:blue()},{id:'red',png:red()}]});
 assert.deepEqual(pixel(inverse,0,0),[0,0,255,255]);
});
test('R9b hidden layers and negative offsets are clipped, not rasterized outside canvas',()=>{
 const q=composeLayers({width:2,height:2,layers:[{id:'hide',png:blue(),visible:false},{id:'shift',png:blue(),x:-1,y:1}]});
 assert.deepEqual(pixel(q,0,1),[0,0,255,255]);
 assert.deepEqual(pixel(q,1,1),[0,0,0,0]);
 assert.deepEqual(pixel(q,0,0),[0,0,0,0]);
});
test('R9b per-part mask preserves source RGB while multiplying only alpha',()=>{
 const a=src(1,1,[240,90,50,128]),m=src(1,1,[5,5,5,128]);
 const out=applyAlphaMask(a,m);
 assert.deepEqual(pixel(out),[240,90,50,64]);
 assert.deepEqual(pixel(a),[240,90,50,128],'original remains unchanged');
 assert.throws(()=>applyAlphaMask(a,blue()),/R9B_/);
});
test('R9b rejects malformed layers, extreme sizes and duplicate identities',()=>{
 for(const request of [
 {width:4096,height:4096,layers:[]},
 {width:2,height:2,layers:[{id:'same',png:red()},{id:'same',png:red()}]},
 {width:2,height:2,layers:[{id:'http://evil',png:red()}]},
 {width:2,height:2,layers:[{id:'x',png:red(),opacity:2}]},
 {width:2,height:2,layers:[{id:'x',png:red(),x:0.5}]},
 {width:2,height:2,layers:[{id:'x',png:Buffer.from('not PNG')}]},
 ]) assert.throws(()=>composeLayers(request),/R9B_|AI_PNG_REJECTED/);
});
