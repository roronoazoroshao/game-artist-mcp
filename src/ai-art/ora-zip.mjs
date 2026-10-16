import {inflateRawSync} from 'node:zlib';

const pathAllowed=/^(?:mimetype|stack\.xml|mergedimage\.png|Thumbnails\/thumbnail\.png|data\/[a-z][a-z0-9_]{0,63}\.png)$/;
const fail=why=>{throw new Error('R9B_ORA_REJECTED: '+why)};
const MAX_COMPRESSED=24*1024*1024;
const MAX_RAW=64*1024*1024;
const MAX_ENTRIES=80;
const crcTable=Uint32Array.from({length:256},(_,n)=>{
 let c=n;
 for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);
 return c>>>0;
});
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function isValidName(name){
 return typeof name==='string'&&pathAllowed.test(name)&&!name.includes('..')&&!name.includes('\\')&&!name.includes('//');
}
function checkEntryName(name){if(!isValidName(name))fail('unsafe/unsupported ZIP path')}
function bytesLimit(name,bytes){
 if(name==='stack.xml')return 65536;
 if(name==='mimetype')return 64;
 return 4*1024*1024;
}
export function writeOraZip(entries){
 if(!Array.isArray(entries)||entries.length<5||entries.length>MAX_ENTRIES||entries[0]?.name!=='mimetype')fail('invalid first ZIP entry');
 const seen=new Set(),locals=[],centrals=[];let offset=0,total=0;
 for(const item of entries){
  const name=item?.name,bytes=item?.bytes;
  checkEntryName(name);
  if(seen.has(name)||!Buffer.isBuffer(bytes)||bytes.length>bytesLimit(name,bytes))fail('duplicate name or entry budget');
  seen.add(name);
  total+=bytes.length;
  if(total>MAX_RAW)fail('raw ZIP budget');
  const nameBuf=Buffer.from(name,'utf8'),crc=crc32(bytes);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(0,8);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);
  local.writeUInt16LE(nameBuf.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(0x0314,4);central.writeUInt16LE(20,6);
  central.writeUInt16LE(0x800,8);central.writeUInt16LE(0,10);
  central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);
  central.writeUInt16LE(nameBuf.length,28);
  central.writeUInt32LE((0o100644<<16)>>>0,38);central.writeUInt32LE(offset,42);
  locals.push(local,nameBuf,bytes);
  centrals.push(central,nameBuf);
  offset+=local.length+nameBuf.length+bytes.length;
 }
 const centralOffset=offset,centralSize=centrals.reduce((a,b)=>a+b.length,0);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(centralSize,12);end.writeUInt32LE(centralOffset,16);
 const result=Buffer.concat([...locals,...centrals,end]);
 if(result.length>MAX_COMPRESSED)fail('compressed ORA file budget');
 return result;
}
export function readOraZip(archive){
 if(!Buffer.isBuffer(archive)||archive.length<100||archive.length>MAX_COMPRESSED)fail('invalid ZIP bytes or length');
 const eocd=archive.length-22;
 if(archive.readUInt32LE(eocd)!==0x06054b50||archive.readUInt16LE(eocd+20)!==0||
 archive.readUInt16LE(eocd+4)!==0||archive.readUInt16LE(eocd+6)!==0||
 archive.readUInt16LE(eocd+8)!==archive.readUInt16LE(eocd+10))fail('unsupported ZIP tail/volume/comment');
 const count=archive.readUInt16LE(eocd+10),centralSize=archive.readUInt32LE(eocd+12),centralOffset=archive.readUInt32LE(eocd+16);
 if(count<5||count>MAX_ENTRIES||centralOffset+centralSize!==eocd)fail('ZIP central directory layout/budget');
 let pos=centralOffset,total=0;const seen=new Set(),entries=[],ranges=[];
 for(let i=0;i<count;i++){
  if(pos+46>eocd||archive.readUInt32LE(pos)!==0x02014b50)fail('bad central entry');
  const flags=archive.readUInt16LE(pos+8),method=archive.readUInt16LE(pos+10),expectedCrc=archive.readUInt32LE(pos+16);
  const compressed=archive.readUInt32LE(pos+20),rawSize=archive.readUInt32LE(pos+24);
  const nlen=archive.readUInt16LE(pos+28),extraLen=archive.readUInt16LE(pos+30),commentLen=archive.readUInt16LE(pos+32);
  const ext=archive.readUInt32LE(pos+38),localOff=archive.readUInt32LE(pos+42);
  const endName=pos+46+nlen,endEntry=endName+extraLen+commentLen;
  if(nlen===0||extraLen>4096||endEntry>eocd||(flags&1)||!(method===0||method===8)||
 rawSize===0||rawSize>MAX_RAW||compressed>MAX_COMPRESSED)fail('encrypted/unsupported ZIP entry header');
  const name=archive.toString('utf8',pos+46,endName);
  checkEntryName(name);
  if(Buffer.byteLength(name)!==nlen||seen.has(name)||rawSize>bytesLimit(name))fail('duplicate/unsafe ZIP path/budget');
  if(((ext>>>16)&0o170000)===0o120000)fail('ZIP symlink forbidden');
  if(method===0&&compressed!==rawSize)fail('STORED size mismatch');
  if(compressed===0||rawSize>compressed*256+1024)fail('ZIP decompression ratio');
  if(localOff+30>centralOffset||archive.readUInt32LE(localOff)!==0x04034b50)fail('bad local ZIP entry');
  const localFlags=archive.readUInt16LE(localOff+6),localMethod=archive.readUInt16LE(localOff+8);
  const localNameLength=archive.readUInt16LE(localOff+26),localExtra=archive.readUInt16LE(localOff+28);
  const dataOffset=localOff+30+localNameLength+localExtra;
  if(localMethod!==method||localFlags!==flags||localNameLength!==nlen||
 dataOffset+compressed>centralOffset||
 archive.toString('utf8',localOff+30,localOff+30+localNameLength)!==name)fail('local and central mismatch');
  if(!(flags&8)&&(archive.readUInt32LE(localOff+14)!==expectedCrc||
 archive.readUInt32LE(localOff+18)!==compressed||archive.readUInt32LE(localOff+22)!==rawSize))fail('local size or CRC mismatch');
  ranges.push([localOff,dataOffset+compressed]);
  const encoded=archive.subarray(dataOffset,dataOffset+compressed);
  let decoded;
  try{decoded=method===0?Buffer.from(encoded):inflateRawSync(encoded,{maxOutputLength:rawSize})}
  catch{fail('deflate error/expansion limit')}
  if(decoded.length!==rawSize||crc32(decoded)!==expectedCrc)fail('uncompressed size/CRC mismatch');
  total+=decoded.length;
  if(total>MAX_RAW)fail('aggregate decompression budget');
  seen.add(name);entries.push({name,bytes:decoded,method,localOff});pos=endEntry;
 }
 if(pos!==eocd||ranges.length!==count)fail('ZIP central padding');
 ranges.sort((a,b)=>a[0]-b[0]);
 if(ranges[0][0]!==0||ranges.some((r,i)=>i>0&&r[0]<ranges[i-1][1]))fail('overlapping/leading ZIP content');
 const first=entries.find(e=>e.localOff===0);
 if(first?.name!=='mimetype'||first.method!==0||first.bytes.toString('utf8')!=='image/openraster')fail('ORA first mimetype invalid');
 return new Map(entries.map(e=>[e.name,e.bytes]));
}
