import assert from 'node:assert/strict';
import test from 'node:test';
import pngjs from 'pngjs';
import {readFile} from 'node:fs/promises';
import {cropAlphaPng,renderCutoutFrames} from '../src/cutout/raster.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
const {PNG}=pngjs;
const baseDoc=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const baseCut=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
function png(width,height,points=[]){
 const p=new PNG({width,height,colorType:6});
 p.data.fill(0);
 for(const [x,y,alpha] of points){const o=(y*width+x)*4;p.data[o]=220;p.data[o+1]=160;p.data[o+2]=120;p.data[o+3]=alpha;}
 return PNG.sync.write(p);
}
function cutout(){
 const d=structuredClone(baseDoc),c=structuredClone(baseCut);
 d.nodes.push({id:'flame_variant_0',type:'ellipse',cx:128,cy:170,rx:8,ry:16,fill:'#69d7cf',appearance:{material:'spirit',outerGlow:{color:'#69d7cf',opacity:0.3,radius:3}}});
 d.nodes.push({id:'flame_variant_1',type:'ellipse',cx:126,cy:170,rx:7,ry:18,fill:'#72f5ec'});
 c.version=2;c.rendering={format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1};
 c.poseVariants=[{id:'flame_a',part:'flame',nodes:['flame_variant_0']},{id:'flame_b',part:'flame',nodes:['flame_variant_1']}];
 c.frameSequence={part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true};
 return {d,c};
}
test('alpha crop preserves semi-transparent antialias and inclusive odd bounds',()=>{
 const raw=png(7,5,[[1,2,128],[4,3,255]]);
 const crop=cropAlphaPng(raw,{paddingPx:1});
 assert.deepEqual(crop.contentRect,{x:1,y:2,width:4,height:2});
 assert.deepEqual(crop.sourceRect,{x:0,y:1,width:6,height:4});
 assert.equal(crop.width,6);assert.equal(crop.height,4);
 assert.equal(crop.pixels[(1*crop.width+1)*4+3],128);
 assert.equal(crop.pixels[(2*crop.width+4)*4+3],255);
});
test('bounded decoder rejects invalid CRC, empty alpha and enormous IHDR',()=>{
 assert.throws(()=>cropAlphaPng(png(3,3),{paddingPx:2}),/empty|alpha/i);
 const p=png(3,3,[[1,1,255]]);
 assert.throws(()=>cropAlphaPng(Buffer.from('not png'),{paddingPx:2}),/PNG|signature/);
 const tampered=Buffer.from(p);tampered[20]^=1;
 assert.throws(()=>cropAlphaPng(tampered,{paddingPx:2}),/CRC|PNG|header/i);
 assert.throws(()=>cropAlphaPng(Buffer.alloc(8388609),{paddingPx:2}),/budget|large|PNG/);
});
test('per-part and per-pose material-aware renders remain independent',async()=>{
 const {d,c}=cutout(),compiled=compileCutout(d,c,{revision:5});
 const frames=await renderCutoutFrames(compiled,{});
 const ids=frames.map(f=>f.partId+'/'+(f.poseId??'base'));
 assert.equal(frames.length,7);
 assert.equal(new Set(ids).size,7);
 assert.ok(ids.includes('flame/flame_a'));assert.ok(ids.includes('flame/flame_b'));
 assert.ok(frames.every(f=>f.rawPng.length>32 && f.crop.width>0 && f.crop.height>0));
 assert.notEqual(frames.find(f=>f.poseId==='flame_a').sourceSvgSha256,frames.find(f=>f.poseId==='flame_b').sourceSvgSha256);
});
test('v2 raster rejects external paint URL instead of asking librsvg to fetch',async()=>{
 const {d,c}=cutout();
 d.nodes.find(n=>n.id==='roof').fill='url(https://example.com/attacker.svg)';
 assert.throws(()=>compileCutout(d,c,{revision:7}),/unsafe|paint|external|url/i);
});
