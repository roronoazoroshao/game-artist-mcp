import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const generated='examples/spirit-lantern/generated/phase3-godot/r8-light-probe';
test('R8b Godot capture supports a controlled lit/unlit environment probe',async()=>{
 const script=await readFile(new URL('../scripts/phase3-showcase-capture.gd',import.meta.url),'utf8');
 assert.match(script,/--capture-r8-light-probe/,'missing opt-in controlled light capture mode');
 assert.match(script,/r8-light-probe/,'missing real framebuffer file destination');
 assert.match(script,/frame_post_draw/);
});
test('R8b real Godot altar brightens locally when light is enabled',{skip:process.env.R8_CAPTURE_VERIFICATION!=='1'},async()=>{
 const read=async f=>PNG.sync.read(await readFile(join(generated,f)),{checkCRC:true});
 const lit=await read('lit.png'),unlit=await read('unlit.png');
 for(const p of [lit,unlit]){assert.equal(p.width,512);assert.equal(p.height,512);}
 const metrics=(xmin,xmax,ymin,ymax)=>{
  let changed=0,count=0,sumGreen=0,sumRed=0;
  for(let y=ymin;y<=ymax;y+=2)for(let x=xmin;x<=xmax;x+=2){
   const i=(y*512+x)*4;const dg=lit.data[i+1]-unlit.data[i+1];
   const dr=lit.data[i]-unlit.data[i];
   sumGreen+=dg;sumRed+=dr;count++;
   if(Math.abs(dg)+Math.abs(dr)>9)changed++;
  }
  return {deltaGreen:sumGreen/count,deltaRed:sumRed/count,changedRatio:changed/count};
 };
 // Altar surface excludes lantern sprite y<350. It must respond more strongly
 // than sky, rejecting a global color overlay or shader TIME-only difference.
 const altar=metrics(186,324,375,430);
 const sky=metrics(35,150,50,120);
 assert.ok(altar.deltaGreen>0.45,'altar lacks real localized green bounce '+JSON.stringify({altar,sky}));
 assert.ok(altar.changedRatio>0.10,'light disabled without changing surrounding altar pixels '+JSON.stringify({altar,sky}));
 assert.ok(altar.deltaGreen>sky.deltaGreen+0.3,'scene-wide tint is not localized lighting '+JSON.stringify({altar,sky}));
 assert.ok(altar.deltaGreen>altar.deltaRed,'spirit light lost cyan emphasis '+JSON.stringify({altar,sky}));
});
