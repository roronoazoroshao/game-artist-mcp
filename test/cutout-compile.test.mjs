import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {compileCutout,selectPartDocument} from '../src/cutout/compile.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const src=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
function fixture(){
 const doc=copy(src),cut=copy(manifest);
 doc.nodes.push({id:'flame_variant_0',type:'ellipse',cx:126,cy:170,rx:9,ry:19,fill:'#69d7cf'});
 doc.nodes.push({id:'flame_variant_1',type:'ellipse',cx:132,cy:171,rx:8,ry:22,fill:'#b9fff4'});
 cut.version=2;
 cut.rendering={format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1};
 cut.poseVariants=[{id:'flame_a',part:'flame',nodes:['flame_variant_0']},{id:'flame_b',part:'flame',nodes:['flame_variant_1']}];
 cut.frameSequence={part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true};
 return {doc,cut};
}
test('compiler pins source revision SHA and never mutates inputs',()=>{
 const {doc,cut}=fixture(),sourceSnapshot=copy(doc),manifestSnapshot=copy(cut);
 const a=compileCutout(doc,cut,{revision:7});
 const b=compileCutout(copy(doc),copy(cut),{revision:7});
 assert.equal(a.sourceRevision,7);assert.match(a.sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(a.sourceSha256,b.sourceSha256);assert.equal(a.manifestSha256,b.manifestSha256);
 assert.deepEqual(doc,sourceSnapshot);assert.deepEqual(cut,manifestSnapshot);
 doc.nodes.find(x=>x.id==='glass').fill='#69d7cf';
 const edited=compileCutout(doc,cut,{revision:8});
 assert.notEqual(edited.sourceSha256,a.sourceSha256);
 assert.notEqual(edited.sourceRevision,a.sourceRevision);
});
test('compiler selects exactly one flame pose without leaking base or other variant',()=>{
 const {doc,cut}=fixture();
 const compiled=compileCutout(doc,cut,{revision:3});
 const onlyB=selectPartDocument(compiled,'flame','flame_b');
 assert.deepEqual(onlyB.nodes.map(x=>x.id),['flame_variant_1']);
 const base=selectPartDocument(compiled,'flame',null);
 assert.deepEqual(base.nodes.map(x=>x.id),['flame','flame_core']);
 assert.ok(!onlyB.nodes.some(x=>['flame','flame_core','flame_variant_0'].includes(x.id)));
 assert.throws(()=>selectPartDocument(compiled,'body','flame_a'),/pose|part/);
 assert.throws(()=>selectPartDocument(compiled,'flame','no_pose'),/pose/);
});
test('invalid or unrevisioned art never produces a compiled package',()=>{
 const {doc,cut}=fixture();
 assert.throws(()=>compileCutout(doc,cut,{revision:NaN}),/revision/);
 assert.throws(()=>compileCutout(doc,cut,{revision:-1}),/revision/);
 cut.frameSequence.frames[0]='undefined_pose';
 assert.throws(()=>compileCutout(doc,cut,{revision:0}),/invalid|frame|pose/);
});
