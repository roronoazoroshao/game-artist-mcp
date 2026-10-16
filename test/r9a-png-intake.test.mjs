import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {inspectAiPng} from '../src/ai-art/png-intake.mjs';

const {PNG}=pngjs;
function validPng(w=2,h=2) {
 const png=new PNG({width:w,height:h,colorType:6});
 for(let i=0;i<png.data.length;i+=4){png.data[i]=120;png.data[i+1]=80;png.data[i+2]=20;png.data[i+3]=i===0?0:255;}
 return PNG.sync.write(png);
}
function rejected(bytes){
 assert.throws(()=>inspectAiPng(bytes),e=>e instanceof Error&&e.message.startsWith('AI_PNG_REJECTED:'), 'expected explicit raster rejection');
}
test('R9a accepts only content-verified RGBA PNG and calculates input SHA256',()=>{
 const raw=validPng();
 const info=inspectAiPng(raw);
 assert.deepEqual([info.width,info.height],[2,2]);
 assert.equal(info.sourceSha256,createHash('sha256').update(raw).digest('hex'));
 assert.equal(Object.hasOwn(info,'decodedPixels'),false,'should not leak mutable decoder buffer');
});
test('R9a rejects truncated, corrupt or unsupported PNG header/payload',()=>{
 const original=validPng();
 rejected(Buffer.alloc(0));
 rejected(Buffer.from('not a PNG'));
 rejected(original.subarray(0,20));
 const crcCorrupt=Buffer.from(original);crcCorrupt[crcCorrupt.length-8]^=1;rejected(crcCorrupt);
 const nonRgba=Buffer.from(original);nonRgba[25]=2;rejected(nonRgba);
 const interlace=Buffer.from(original);interlace[28]=1;rejected(interlace);
 const huge=Buffer.from(original);huge.writeUInt32BE(5000,16);rejected(huge);
 const bomb=Buffer.from(original);bomb.writeUInt32BE(4096,16);bomb.writeUInt32BE(4096,20);rejected(bomb);
});
test('R9a rejects encoded byte budget before decode and rejects non-Buffer inputs',()=>{
 rejected(Buffer.alloc(4*1024*1024+1));
 assert.throws(()=>inspectAiPng('png'),/AI_PNG_REJECTED/);
});
