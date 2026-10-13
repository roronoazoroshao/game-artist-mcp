import assert from 'node:assert/strict';
import test from 'node:test';
import pngjs from 'pngjs';
import {cropAlphaPng} from '../src/cutout/raster.mjs';
import {packAtlas,verifyAtlas} from '../src/cutout/atlas.mjs';
const {PNG}=pngjs;
function make(partId,poseId=null,x=7,y=9,w=11,h=13){
 const W=32,H=32,p=new PNG({width:W,height:H,colorType:6});p.data.fill(0);
 for(let iy=y;iy<y+h;iy++)for(let ix=x;ix<x+w;ix++){
  const i=(iy*W+ix)*4;p.data[i]=100;p.data[i+1]=220;p.data[i+2]=200;p.data[i+3]=255;
 }
 const crop=cropAlphaPng(PNG.sync.write(p),{paddingPx:0});
 return {partId,poseId,crop,pivotSource:[12,15],sourceSvgSha256:'a'.repeat(64),sourceRevision:1,sourceSha256:'b'.repeat(64)};
}
test('deterministic atlas is byte-identical in any input order',()=>{
 const frames=[make('body'),make('flame'),make('tassel'),make('flame','flame_a'),make('flame','flame_b'),make('talisman_left'),make('talisman_right')];
 const one=packAtlas(frames,{maxAtlasSize:256,paddingPx:4});
 assert.equal(verifyAtlas(one).ok,true);
 for(const input of [frames.slice().reverse(),frames.slice(2).concat(frames.slice(0,2)),frames.slice().sort((a,b)=>b.partId.localeCompare(a.partId))]){
  const another=packAtlas(input,{maxAtlasSize:256,paddingPx:4});
  assert.equal(one.atlasSha256,another.atlasSha256);
  assert.deepEqual(one.regions,another.regions);
 }
 assert.equal(one.regions.length,7);
 assert.ok(one.atlasWidth<=256&&one.atlasHeight<=256);
});
test('atlas keeps odd crop pivot and guards padding/overlap',()=>{
 const one=packAtlas([make('body')],{maxAtlasSize:256,paddingPx:4});
 const rect=one.regions[0];
 assert.deepEqual(rect.localSpriteOffset,[0.5,0.5]);
 assert.deepEqual(rect.pixelRect,{x:7,y:9,width:11,height:13});
 assert.equal(verifyAtlas(one).ok,true);
 const corrupt={...one,regions:structuredClone(one.regions)};
 corrupt.regions[0].textureRect.x=-1;
 assert.equal(verifyAtlas(corrupt).ok,false);
 const fail=make('giant',null,0,0,32,32);
 assert.throws(()=>packAtlas([fail],{maxAtlasSize:16,paddingPx:4}),/ATLAS_OVERFLOW|atlas|size/i);
});
test('duplicate frame identity and illegal metadata never get packed',()=>{
 const a=make('body');
 assert.throws(()=>packAtlas([a,a],{maxAtlasSize:256,paddingPx:4}),/duplicate/i);
 assert.throws(()=>packAtlas([a],{maxAtlasSize:256,paddingPx:9}),/padding/i);
});
