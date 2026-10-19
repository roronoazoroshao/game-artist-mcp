import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import pngjs from 'pngjs';

const {PNG}=pngjs;
const captureRoot=join(dirname(fileURLToPath(import.meta.url)),'../examples/linh-hoa/captures');
async function readPng(name) {
  const bytes=await readFile(join(captureRoot,name));
  return PNG.sync.read(bytes,{checkCRC:true});
}
function distinctColors(image) {
  const colors=new Set();
  for(let i=0;i<image.data.length;i+=4)colors.add([image.data[i],image.data[i+1],image.data[i+2]].join(','));
  return colors.size;
}
function motionPixels(a,b,region) {
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let changed=0;
  for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++){
    const i=(y*a.width+x)*4;
    if(Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k])))>4)changed++;
  }
  return changed;
}
test('Native Godot SubViewport samples are authentic RGB PNG fixtures at 64 and 128',async()=>{
  for(const edge of [64,128]) {
    const image=await readPng('native-'+edge+'.png');
    assert.equal(image.width,edge);assert.equal(image.height,edge);
    assert.ok(distinctColors(image)>40,'thumbnail contains authored readable multi-color silhouette');
    let bright=0;
    for(let i=0;i<image.data.length;i+=4)if(image.data[i+1]>170&&image.data[i+2]>130)bright++;
    assert.ok(bright>10,'distinct luminous spirit-fire pixels');
  }
});
test('Actual game framebuffer image dimensions and timeline are present',async()=>{
  for(let i=0;i<4;i++) {
    const image=await readPng('game-'+String(i).padStart(2,'0')+'.png');
    assert.equal(image.width,960);assert.equal(image.height,540);
    assert.ok(distinctColors(image)>100);
  }
});
test('Frames really differ inside the flame region over time',async()=>{
  const images=await Promise.all([0,1,2,3].map(i=>readPng('game-'+String(i).padStart(2,'0')+'.png')));
  for(let i=0;i<3;i++)assert.ok(motionPixels(images[i],images[i+1],[400,140,560,410])>300,'timeline frame changed visibly');
});
