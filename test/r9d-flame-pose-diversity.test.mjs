import test from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {inspectR9dFlamePoseSet} from '../src/ai-art/r9d-flame-diversity.mjs';
const {PNG}=pngjs;
const poses=['flame_a','flame_b','flame_c','flame_d'];

function sample(n,onePixel=false){
 const p=new PNG({width:64,height:64,colorType:6});
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let on=false;
  if(n===0)on=(x>=23&&x<=39&&y>=9&&y<=54);
  if(n===1)on=(x>=16&&x<=44&&y>=15&&y<=49&&(x-16)%(y%6+4)<(y%6+2));
  if(n===2)on=(x>=18&&x<=43&&y>=13&&y<=53&&x>=(y%15)+13);
  if(n===3)on=(x>=20&&x<=44&&y>=11&&y<=50&&(x+y)%9<=5);
  if(onePixel&&x===0&&y===0)on=true;
  const i=4*(y*64+x);
  p.data[i]=20;p.data[i+1]=220;p.data[i+2]=240;p.data[i+3]=on?255:0;
 }
 return PNG.sync.write(p);
}
function source(arr=[0,1,2,3]){
 return new Map(poses.map((id,i)=>[id,sample(arr[i])]));
}
test('R9d flame diversity gate enforces four distinct actual alpha silhouettes',()=>{
 const result=inspectR9dFlamePoseSet(source());
 assert.equal(result.status,'TECHNICAL_POSE_VARIANCE_ONLY');
 assert.deepEqual(result.poses,poses);
 assert.equal(result.exportAllowed,false);
 assert.equal(result.artisticReview,'UNSCORED');
 assert.ok(result.adjacentDifferences.every(v=>v.distance>=0.05));
});
test('R9d gate rejects four reused paint buffers even if their pose ids differ',()=>{
 assert.throws(()=>inspectR9dFlamePoseSet(source([0,0,0,0])),/R9D_POSE_REJECTED/);
});
test('R9d gate rejects a one-pixel mutation masquerading as motion',()=>{
 const imgs=source([0,1,2,3]);
 imgs.set('flame_b',sample(0,true));
 assert.throws(()=>inspectR9dFlamePoseSet(imgs),/R9D_POSE_REJECTED/);
});
test('R9d gate rejects missing poses, duplicate unexpected pose and malformed sources',()=>{
 const m=source();m.delete('flame_c');
 assert.throws(()=>inspectR9dFlamePoseSet(m),/R9D_POSE_REJECTED/);
 const extra=source();extra.set('flame_e',sample(2));
 assert.throws(()=>inspectR9dFlamePoseSet(extra),/R9D_POSE_REJECTED/);
 const corrupt=source();corrupt.set('flame_a',Buffer.from('not PNG'));
 assert.throws(()=>inspectR9dFlamePoseSet(corrupt),/R9D_POSE_REJECTED|AI_PNG_REJECTED/);
});
