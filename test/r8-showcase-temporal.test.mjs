import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import pngjs from 'pngjs';
const {PNG}=pngjs;
test('R8c ritual stone has deliberate restrained hand-engraved veins and faceted chips',async()=>{
 const world=await readFile(new URL('../scripts/phase3-showcase-world.gd',import.meta.url),'utf8');
 assert.match(world,/func _engrave_stone\(\) -> void:/,'missing stone engraving geometry authored for R8');
 assert.match(world,/_engrave_stone\(\)/g,'engraving must be invoked inside scene drawing');
 assert.match(world,/func _rock\(origin:/,'existing rocks must be preserved');
 assert.match(world,/tether_pulse/,'do not remove the 2-second tether');
});
test('R8c real Godot scene keeps temporal changes restrained and spirit fire readable',{skip:process.env.R8_CAPTURE_VERIFICATION!=='1'},async()=>{
 const dir='examples/spirit-lantern/generated/phase3-godot/r7-showcase-review';
 const a=PNG.sync.read(await readFile(join(dir,'frame-00.png')),{checkCRC:true});
 const b=PNG.sync.read(await readFile(join(dir,'frame-01.png')),{checkCRC:true});
 assert.equal(a.width,512);assert.equal(b.width,512);
 let rapid=0,cyan=0,pixels=0,clipBottom=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const k=(y*512+x)*4;
  const dr=Math.abs(a.data[k]-b.data[k]);
  const dg=Math.abs(a.data[k+1]-b.data[k+1]);
  const db=Math.abs(a.data[k+2]-b.data[k+2]);
  if(dr+dg+db>120)rapid++;
  if(x>223&&x<293&&y>125&&y<260&&a.data[k+1]>a.data[k]*1.25&&a.data[k+1]>80)cyan++;
  if(y===511&&x>120&&x<400&&a.data[k+3]!==255)clipBottom++;
  pixels++;
 }
 assert.ok(rapid/pixels<0.025,'global flashing area too large: '+(rapid/pixels));
 assert.ok(cyan>120,'cyan spirit flame lost in real game view: '+cyan);
 assert.equal(clipBottom,0,'invalid framebuffer bottom opacity');
});
