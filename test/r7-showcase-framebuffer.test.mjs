import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {createHash} from 'node:crypto';

const {PNG}=pngjs;
const folder='examples/spirit-lantern/generated/phase3-godot/r7-showcase-review';
test('R7 saved frames come from real 512px Godot viewport and show authored environment',{skip: process.env.R7_CAPTURE_VERIFICATION!=='1'},async()=>{
 const frames=[];
 for(let i=0;i<4;i++){
  const file=join(folder,'frame-'+String(i).padStart(2,'0')+'.png');
  const bytes=await readFile(file);
  const png=PNG.sync.read(bytes,{checkCRC:true});
  assert.equal(png.width,512);
  assert.equal(png.height,512);
  const palette=new Set();
  let illuminated=0,ink=0,visible=0;
  for(let y=16;y<496;y+=4)for(let x=16;x<496;x+=4){
   const offset=(y*png.width+x)*4;
   const r=png.data[offset],g=png.data[offset+1],b=png.data[offset+2];
   if(png.data[offset+3]===0)continue;
   palette.add([r>>4,g>>4,b>>4].join(','));
   if(g>r*1.1&&g>b*.85&&g>75)illuminated++;
   if(r<50&&g<75&&b<95)ink++;
   if(r>10||g>10||b>10)visible++;
  }
  assert.ok(palette.size>28,'R7 screenshot lacks color variety: '+palette.size);
  assert.ok(illuminated>30,'R7 missing cyan spirit/environment accent: '+illuminated);
  assert.ok(ink>400,'R7 lacks dark atmospheric areas: '+ink);
  assert.ok(visible>2000,'R7 is mostly blank: '+visible);
  frames.push({bytes,png,sha:createHash('sha256').update(bytes).digest('hex')});
 }
 assert.equal(new Set(frames.map(f=>f.sha)).size,4,'animation frames must differ in real Godot render');
 let altered=0;
 for(let i=0;i<frames[0].png.data.length;i+=4){
  const a=frames[0].png.data,b=frames[1].png.data;
  if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>25)altered++;
 }
 assert.ok(altered>120,'Godot frames lack observable motion: '+altered);
});
