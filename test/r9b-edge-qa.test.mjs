import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {analyzeLayerEdges} from '../src/ai-art/edge-qa.mjs';
const {PNG}=pngjs;
function image(w,h,rgba){const p=new PNG({width:w,height:h,colorType:6});for(let i=0;i<p.data.length;i+=4)p.data.set(rgba,i);return PNG.sync.write(p)}
const mask=(w,h,a=255)=>image(w,h,[0,0,0,a]);
const source=(png,x=1,y=1,id='body_color')=>({id,partId:'body',png,x,y,visible:true});
const qa=(l,ownerMasks=new Map([['body',mask(5,5)]]))=>analyzeLayerEdges({width:5,height:5,layers:l,ownerMasks});
test('R9b static seam QA accepts correctly owned painted pixel away from canvas border',()=>{
 const res=qa([source(image(1,1,[100,120,180,255]))]);
 assert.equal(res.status,'PASS');assert.equal(res.findings.length,0);
 assert.equal(res.metrics.visibleAlphaPixels,1);
});
test('R9b flags saturated hidden RGB adjacent to painted alpha edge as advisory fringe only',()=>{
 const p=new PNG({width:2,height:1,colorType:6});
 p.data.set([30,90,200,255],0);p.data.set([255,0,0,0],4);
 const out=qa([source(PNG.sync.write(p))]);
 assert.equal(out.status,'WARN');
 assert.ok(out.findings.some(f=>f.code==='RGB_IN_TRANSPARENT_EDGE'&&f.severity==='WARN'));
});
test('R9b rejects source pixel ownership escaping its part alpha mask',()=>{
 const p=image(2,1,[120,80,50,255]);
 const m=new PNG({width:5,height:5,colorType:6});m.data.fill(0);
 m.data.set([0,0,0,255],(1*5+1)*4);
 const report=qa([source(p)],new Map([['body',PNG.sync.write(m)]]));
 assert.equal(report.status,'INVALID');
 assert.ok(report.findings.some(f=>f.code==='OWNER_MASK_ESCAPE'&&f.severity==='INVALID'));
});
test('R9b warns on opaque content touching canvas boundary, rejects out of canvas placements',()=>{
 const edge=qa([source(image(1,1,[1,2,3,255]),0,0)]);
 assert.equal(edge.status,'WARN');
 assert.ok(edge.findings.some(f=>f.code==='CANVAS_EDGE_TOUCH'));
 assert.throws(()=>qa([source(image(2,2,[1,2,3,255]),4,4)]),/R9B_EDGE_/);
});
test('R9b allows intentionally soft emissive alpha if RGB is coherent, requires valid ownership maps',()=>{
 const p=new PNG({width:3,height:3,colorType:6});
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
 const k=(y*3+x)*4;p.data.set([220,150,40,(x===1&&y===1)?255:40],k);
 }
 const out=qa([source(PNG.sync.write(p),1,1)]);
 assert.equal(out.status,'PASS');
 assert.throws(()=>qa([source(image(1,1,[1,2,3,255]))],new Map()),/R9B_EDGE_/);
 assert.throws(()=>qa([source(image(1,1,[1,2,3,255]),1,1,'http://bad')]),/R9B_EDGE_/);
});
