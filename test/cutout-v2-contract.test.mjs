import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {validateCutout} from '../src/cutout/validate.mjs';

const src=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const old=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const doc=clone(src);
 doc.nodes.push({id:'flame_variant_0',type:'ellipse',cx:120,cy:174,rx:10,ry:18,fill:'#69d7cf'});
 doc.nodes.push({id:'flame_variant_1',type:'ellipse',cx:131,cy:176,rx:8,ry:21,fill:'#b9fff4'});
 const cut={
  ...clone(old),version:2,
  rendering:{format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1},
  poseVariants:[
   {id:'flame_a',part:'flame',nodes:['flame_variant_0']},
   {id:'flame_b',part:'flame',nodes:['flame_variant_1']}
  ],
  frameSequence:{part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true}
 };
 return {doc,cut};
}
test('opt-in v2 validates authored variants and five existing base parts',()=>{
 const {doc,cut}=fixture();
 const result=validateCutout(doc,cut);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.warnings,[]);
 assert.equal(validateCutout(src,old).ok,true);
});
test('v2 fails on invalid ownership, manifests and unknown pose without regressing v1',()=>{
 const errors=[
  (d,m)=>{m.badProperty=true;},
  (d,m)=>{m.parts[1].nodes.push('roof');},
  (d,m)=>{m.poseVariants[1].nodes=['flame_variant_0'];},
  (d,m)=>{d.nodes.push({id:'orphan',type:'ellipse',cx:20,cy:20,rx:3,ry:3,fill:'#69d7cf'});},
  (d,m)=>{m.poseVariants[1].part='body';},
  (d,m)=>{m.frameSequence.frames[0]='unknown';},
  (d,m)=>{m.frameSequence.fps=25;},
  (d,m)=>{m.rendering.maxAtlasSize=4096;},
  (d,m)=>{m.parts[0].pivot=[NaN,1];},
  (d,m)=>{m.parts[0].parent='flame';},
  (d,m)=>{m.animations[0].tracks[0].keys[1].time=0;},
  (d,m)=>{m.animations[0].tracks[3].keys[0].value=[-1,1];},
  (d,m)=>{m.poseVariants[0].id='../evil';},
  (d,m)=>{d.nodes.find(x=>x.id==='roof').transform='translate(1) url(https://example.org/x)';}
 ];
 for(const change of errors){
  const {doc,cut}=fixture();change(doc,cut);
  let result;
  assert.doesNotThrow(()=>{result=validateCutout(doc,cut)});
  assert.equal(result.ok,false,'unexpected v2 acceptance for '+change.toString());
 }
 assert.equal(validateCutout(src,old).ok,true);
});
test('v2 rejects unknown schema version, while legacy warnings remain',()=>{
 const {doc,cut}=fixture();
 cut.version=3;
 assert.equal(validateCutout(doc,cut).ok,false);
 const unowned=clone(src);unowned.nodes.push({id:'new_orphan',type:'ellipse',cx:20,cy:20,rx:2,ry:2});
 const legacy=validateCutout(unowned,old);
 assert.equal(legacy.ok,true);
 assert.ok(legacy.warnings.some(w=>w.includes('not assigned')));
});
