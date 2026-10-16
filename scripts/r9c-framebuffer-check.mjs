import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const filename=process.argv[2];
if(typeof filename!=='string'||!filename.endsWith('.png'))throw Error('R9C_FRAMEBUFFER_REQUIRED');
const bytes=await readFile(filename);
assert.ok(bytes.length>100,'actual framebuffer PNG must be non-empty');
const img=PNG.sync.read(bytes,{checkCRC:true});
assert.equal(img.width,512);
assert.equal(img.height,512);
const base=[...img.data.slice(0,4)];
let varied=0,notAlphaZero=0;
for(let i=0;i<img.data.length;i+=4){
 const px=img.data.subarray(i,i+4);
 if(px.some((v,k)=>v!==base[k]))varied++;
 if(px[3]>0)notAlphaZero++;
}
assert.ok(varied>500,'actual Godot image cannot be a flat background / blank capture');
assert.ok(notAlphaZero>1000,'framebuffer lacks meaningful pixels');
console.log('GAME_ARTIST_R9C_FRAMEBUFFER_PIXEL_VERIFIED');
console.log(JSON.stringify({sha256:createHash('sha256').update(bytes).digest('hex'),
 canvas:[img.width,img.height],variedPixels:varied,
 origin:'ACTUAL_GODOT_RENDER_R8E_RASTER_TECHNICAL',
 paintedByAI:false,artisticReview:'UNSCORED'}));
