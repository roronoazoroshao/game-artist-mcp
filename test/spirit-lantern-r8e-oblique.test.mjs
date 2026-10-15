import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCutout} from '../src/cutout/validate.mjs';
import {auditLoop} from '../src/cutout/animation.mjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {renderCutoutPreview} from '../src/cutout/preview.mjs';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url)));
const rig=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url)));
const get=id=>source.nodes.find(n=>n.id===id);
function area(points){return Math.abs(points.reduce((s,p,i)=>s+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0))/2}
test('R8e adds large authored 3/4 roof, side casing and foot material planes without changing Cutout schema',async()=>{
 for(const id of ['roof_side_shadow','body_side_plane','base_side_plane']){
  const n=get(id);
  assert.ok(n,'missing structural 3/4 material plane '+id);
  assert.equal(n.type,'polygon');
  assert.ok(area(n.points)>145,id+' must be a substantial silhouette plane, not a 1px accent');
  assert.ok(n.points.every(([x,y])=>x>=0&&x<=256&&y>=0&&y<=320),id+' out-of-canvas plane');
  assert.deepEqual(rig.parts.filter(p=>p.nodes.includes(id)).map(p=>p.id),['body']);
 }
 assert.equal(rig.parts.length,5);
 assert.equal(rig.poseVariants.length,4);
 assert.equal(rig.animations[0].length,2);
 assert.equal(validateCutout(source,rig).ok,true);
 const qa=auditLoop(compileCutout(source,rig,{revision:1}),'idle');
 assert.equal(qa.ok,true,JSON.stringify(qa.errors));
});
test('R8e oblique roof and window project visible depth while preserving cyan flame/paper/tassel at 64px',async()=>{
 const roof=get('roof');
 assert.ok(roof.points[1][0]>130,'roof ridge still dead-centre frontal, not 3/4');
 assert.ok(roof.points[2][0]-roof.points[0][0]>95,'roof eaves insufficiently articulated');
 const glass=get('glass');
 assert.ok(glass.d.includes('L 141'),'window side plane lacks oblique convergence');
 const compiled=compileCutout(source,rig,{revision:1});
 const v=await renderCutoutPreview({compiled,clipId:'idle',timeSeconds:0.375});
 const png=PNG.sync.read(v.png,{checkCRC:true});
 assert.equal(png.width,256);assert.equal(png.height,320);
 let cyan=0,red=0,paper=0;
 for(let y=0;y<80;y++)for(let x=0;x<64;x++){
  const o=((y*4+2)*256+(x*4+2))*4;
  const [r,g,b,a]=png.data.subarray(o,o+4);
  if(a<120)continue;
  if(x>25&&x<40&&y>31&&y<59&&g>r*1.25&&b>r)cyan++;
  if(y>=68&&y<78&&r>g*1.18&&r>b*1.12)red++;
  if(x>=12&&x<=52&&y>34&&y<56&&r>g*.99&&g>b*1.09&&r>75)paper++;
 }
 assert.ok(cyan>12&&red>=3&&paper>8,JSON.stringify({cyan,red,paper}));
});

test('R8e volumetric metal planes have bounded hand-authored gradient materials',()=>{
 for(const id of ['roof_side_shadow','body_side_plane','base_side_plane']){
  const n=get(id);
  assert.equal(n.appearance?.material,'metal',id+' lacks material classification');
  const paint=n.appearance?.basePaint;
  assert.equal(paint?.kind,'linearGradient',id+' has a single flat color');
  assert.ok(Array.isArray(paint.stops)&&paint.stops.length>=2);
  assert.notEqual(paint.stops[0].color,paint.stops.at(-1).color,id+' needs light-to-shadow variation');
  for(const stop of paint.stops)assert.ok(stop.at>=0&&stop.at<=1);
 }
});
