import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {writeOpenRaster,readOpenRaster} from '../src/ai-art/openraster.mjs';
import {composeLayers} from '../src/ai-art/layer-composite.mjs';
const {PNG}=pngjs;
function image(w,h,color){const png=new PNG({width:w,height:h,colorType:6});for(let i=0;i<png.data.length;i+=4)png.data.set(color,i);return PNG.sync.write(png)}
const p=(b,x=0,y=0)=>{const q=PNG.sync.read(b,{checkCRC:true});return [...q.data.subarray((y*q.width+x)*4,(y*q.width+x+1)*4)]};
const layers=()=>[
 {id:'alpha',png:image(1,1,[220,30,20,128]),x:1,y:0,opacity:.5,visible:true},
 {id:'omega',png:image(2,2,[20,50,210,255]),x:0,y:0,opacity:1,visible:true}
];
function replaceAllSameLength(buf,from,to){assert.equal(from.length,to.length);const a=Buffer.from(buf),old=Buffer.from(from),next=Buffer.from(to);let count=0;for(let i=0;i<a.length;){const hit=a.indexOf(old,i);if(hit<0)break;next.copy(a,hit);count++;i=hit+old.length}assert.ok(count);return a}
function rejected(bytes){assert.throws(()=>readOpenRaster(bytes),/R9B_ORA_REJECTED|AI_PNG_REJECTED|R9B_INVALID_LAYER/)}
test('R9b writes baseline ORA ZIP with first stored exact mimetype, real PNG layers and editable stack',()=>{
 const bytes=writeOpenRaster({width:2,height:2,layers:layers()});
 assert.equal(bytes.toString('hex',0,4),'504b0304');
 assert.equal(bytes.readUInt16LE(8),0,'first entry STORED');
 assert.equal(bytes.toString('utf8',30,38),'mimetype');
 assert.ok(bytes.includes(Buffer.from('image/openraster')));
 for(const item of ['stack.xml','mergedimage.png','Thumbnails/thumbnail.png','data/alpha.png','data/omega.png'])assert.ok(bytes.includes(Buffer.from(item)),item);
 const doc=readOpenRaster(bytes);
 assert.deepEqual([doc.width,doc.height],[2,2]);
 assert.deepEqual(doc.layers.map(x=>({id:x.id,x:x.x,y:x.y,opacity:x.opacity,visible:x.visible})),[
   {id:'alpha',x:1,y:0,opacity:.5,visible:true},
   {id:'omega',x:0,y:0,opacity:1,visible:true}
 ]);
 assert.deepEqual(p(doc.mergedPng,1,0),p(composeLayers({width:2,height:2,layers:layers()}),1,0));
 assert.deepEqual(p(doc.layers[0].png),p(layers()[0].png));
 assert.match(doc.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(bytes,writeOpenRaster({width:2,height:2,layers:layers()}),'archive is deterministic');
});
test('R9b round trip preserves hidden art layers, offsets, alpha and no invisible merged pixels',()=>{
 const input={width:3,height:3,layers:[
  {id:'alpha',png:image(1,1,[255,255,255,255]),x:-1,y:0,opacity:1,visible:true},
  {id:'omega',png:image(2,1,[10,200,40,128]),x:1,y:1,opacity:1,visible:false},
  {id:'base',png:image(1,1,[1,2,3,255]),x:0,y:2,opacity:1,visible:true}
 ]};
 const doc=readOpenRaster(writeOpenRaster(input));
 assert.deepEqual(doc.layers.map(x=>x.id),['alpha','omega','base']);
 assert.equal(doc.layers[1].visible,false);
 assert.deepEqual(p(doc.mergedPng,1,1),[0,0,0,0]);
 assert.deepEqual(p(doc.mergedPng,0,2),[1,2,3,255]);
 const thumb=PNG.sync.read(doc.thumbnailPng,{checkCRC:true});assert.ok(thumb.width<=256&&thumb.height<=256);
});
test('R9b rejects invalid ZIP path, duplicate name, mismatched CRC, oversized headers and unsupported XML',()=>{
 const original=writeOpenRaster({width:2,height:2,layers:layers()});
 rejected(Buffer.alloc(0));
 rejected(original.subarray(0,original.length-8));
 rejected(replaceAllSameLength(original,'data/alpha.png','/ata/alpha.png'));
 rejected(replaceAllSameLength(original,'data/omega.png','data/alpha.png'));
 rejected(replaceAllSameLength(original,'image/openraster','image/openRasteR'));
 rejected(replaceAllSameLength(original,'svg:src-over','svg:dst-over'));
 rejected(replaceAllSameLength(original,'<layer','<stack'));
 const fake=Buffer.from(original);const central=fake.indexOf(Buffer.from('PK\x01\x02','binary'));assert.ok(central>=0);
 fake.writeUInt32LE(0x7fffffff,central+24);rejected(fake);
 const badMethod=Buffer.from(original);badMethod.writeUInt16LE(99,central+10);rejected(badMethod);
});
test('R9b enforces writer layer budget and rejects unsupported compositing modes',()=>{
 assert.throws(()=>writeOpenRaster({width:2,height:2,layers:[{...layers()[0],blendMode:'svg:screen'}]}),/R9B_/);
 assert.throws(()=>writeOpenRaster({width:2,height:2,layers:Array.from({length:25},(_,i)=>({id:'l'+i,png:image(1,1,[1,2,3,255])}))}),/R9B_/);
});
