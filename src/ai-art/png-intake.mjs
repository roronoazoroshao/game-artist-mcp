import {createHash} from 'node:crypto';
import pngjs from 'pngjs';

const {PNG}=pngjs;
const MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_ENCODED=4*1024*1024;
const MAX_PIXELS=4*1024*1024;
const fail=reason=>{throw new Error('AI_PNG_REJECTED: '+reason)};

/**
 * Inspect untrusted AI-supplied raster bytes, without accepting arbitrary
 * image formats or letting their encoded header allocate an unsafe image.
 * Returns immutable metadata only; does not return a mutable decoder buffer.
 */
export function inspectAiPng(bytes) {
 if(!Buffer.isBuffer(bytes))fail('expected Buffer');
 if(bytes.length<57||bytes.length>MAX_ENCODED)fail('encoded PNG byte budget');
 if(!bytes.subarray(0,8).equals(MAGIC))fail('PNG magic');
 if(bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')fail('missing first IHDR');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(width===0||height===0||width>4096||height>4096||width*height>MAX_PIXELS)fail('decoded pixel budget');
 if(bytes[24]!==8||bytes[25]!==6||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)fail('requires non-interlaced 8-bit RGBA PNG');
 let img;
 try{img=PNG.sync.read(bytes,{checkCRC:true})}
 catch{fail('PNG chunk/CRC/decoder validation')}
 if(img.width!==width||img.height!==height||img.data.length!==width*height*4)fail('decoded image geometry mismatch');
 return Object.freeze({width,height,sourceSha256:createHash('sha256').update(bytes).digest('hex')});
}
