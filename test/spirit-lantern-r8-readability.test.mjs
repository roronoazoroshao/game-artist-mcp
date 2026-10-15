import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pngjs from 'pngjs';
import {compileCutout} from '../src/cutout/compile.mjs';
import {validateCutout} from '../src/cutout/validate.mjs';
import {renderCutoutPreview} from '../src/cutout/preview.mjs';
import {inspectStyle} from '../src/style/inspect.mjs';
import {loadStyleProfile} from '../src/style/profile.mjs';
const {PNG}=pngjs;
const source=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/source.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../examples/spirit-lantern/v2/cutout.json',import.meta.url),'utf8'));
const required=[
 ['roof_rim_lit','body'],['cage_rim_lit','body'],
 ['paper_fold_left','talisman_left'],['paper_fold_right','talisman_right'],
 ['tassel_sheen','tassel']
];
test('R8a authored material planes have exact rig ownership and no unowned decoration',async()=>{
 const nodes=new Map(source.nodes.map(n=>[n.id,n]));
 for(const [id,partId] of required){
  const node=nodes.get(id);
  assert.ok(node,'missing tactile material plane '+id);
  assert.equal(node.type,'path');
  assert.equal(node.fill,'none');
  assert.ok(node.strokeWidth>=2,'subpixel embellishment will alias at gameplay scale');
  const owners=manifest.parts.filter(p=>p.nodes.includes(id));
  assert.deepEqual(owners.map(p=>p.id),[partId],'missing/wrong part ownership for '+id);
 }
 const checked=validateCutout(source,manifest);
 assert.equal(checked.ok,true,checked.errors.join('; '));
 const style=inspectStyle(source,await loadStyleProfile('dark-cultivation-v1'));
 assert.equal(style.ok,true,JSON.stringify(style));
});
test('R8a 64px preview keeps cyan flame, both parchment papers and red tassel with margins',async()=>{
 const compiled=compileCutout(source,manifest,{revision:1});
 for(const t of [0,0.375]){
  const frame=await renderCutoutPreview({compiled,clipId:'idle',timeSeconds:t});
  const png=PNG.sync.read(frame.png,{checkCRC:true});
  assert.equal(png.width,256);assert.equal(png.height,320);
  const features={flame:0,leftPaper:0,rightPaper:0,tassel:0};
  // Fixed coarse 4x samples represent the actual 64-pixel display grid.
  for(let y=0;y<80;y++)for(let x=0;x<64;x++){
   const o=((4*y+2)*png.width+(4*x+2))*4;
   const [r,g,b,a]=png.data.subarray(o,o+4);
   if(a<140)continue;
   if(x>25&&x<40&&y>24&&y<59&&g>r*1.25&&b>r*1.15)features.flame++;
   if(x>12&&x<23&&y>30&&y<56&&r>g*0.99&&g>b*1.08&&r>75)features.leftPaper++;
   if(x>41&&x<53&&y>30&&y<56&&r>g*0.99&&g>b*1.08&&r>75)features.rightPaper++;
   if(x>24&&x<40&&y>66&&y<78&&r>g*1.15&&r>b*1.12)features.tassel++;
  }
  for(const [k,v] of Object.entries(features))assert.ok(v>=3,k+' unreadable on 64px grid: '+JSON.stringify(features));
  assert.ok([...png.data.subarray((png.height-1)*png.width*4)].every((_,i)=>i%4!==3||png.data[(png.height-1)*png.width*4+i]===0),'bottom row clipped');
 }
});