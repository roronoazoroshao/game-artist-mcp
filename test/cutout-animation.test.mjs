import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {compileCutout} from '../src/cutout/compile.mjs';
import {sampleAnimation,auditLoop} from '../src/cutout/animation.mjs';

const copy=x=>JSON.parse(JSON.stringify(x));
const src=JSON.parse(await readFile(new URL('../examples/spirit-lantern/source.json',import.meta.url),'utf8'));
const cut=JSON.parse(await readFile(new URL('../examples/spirit-lantern/cutout.json',import.meta.url),'utf8'));
function fixture(){
 const doc=copy(src),m=copy(cut);
 doc.nodes.push({id:'flame_variant_0',type:'ellipse',cx:120,cy:175,rx:8,ry:18,fill:'#69d7cf'});
 doc.nodes.push({id:'flame_variant_1',type:'ellipse',cx:128,cy:171,rx:9,ry:20,fill:'#b9fff4'});
 m.version=2;
 m.rendering={format:'atlas_png',paddingPx:4,maxAtlasSize:2048,scale:1};
 m.poseVariants=[{id:'flame_a',part:'flame',nodes:['flame_variant_0']},{id:'flame_b',part:'flame',nodes:['flame_variant_1']}];
 m.frameSequence={part:'flame',fps:1,frames:['flame_a','flame_b'],loop:true};
 m.animations[0].tracks.push({part:'flame',property:'light_energy',keys:[{time:0,value:0.85},{time:1,value:1.05},{time:2,value:0.85}]});
 return {doc,m};
}
test('animation samples existing paper sway and frame-selected flame deterministically',()=>{
 const {doc,m}=fixture(),c=compileCutout(doc,m,{revision:1});
 const a=sampleAnimation(c,'idle',0),b=sampleAnimation(c,'idle',1),end=sampleAnimation(c,'idle',2);
 assert.equal(a.parts.talisman_left.rotation,-0.035);
 assert.equal(b.parts.talisman_left.rotation,0.055);
 assert.equal(a.parts.flame.poseId,'flame_a');
 assert.equal(b.parts.flame.poseId,'flame_b');
 assert.equal(end.parts.flame.poseId,'flame_a');
 assert.equal(a.lightEnergy,0.85);assert.equal(b.lightEnergy,1.05);
 assert.deepEqual(sampleAnimation(c,'idle',1),b);
 assert.throws(()=>sampleAnimation(c,'idle',-1),/time/);
 assert.throws(()=>sampleAnimation(c,'missing',0),/clip/);
});
test('quality auditor actually samples two cycles and rejects large continuous jumps',()=>{
 const {doc,m}=fixture(),c=compileCutout(doc,m,{revision:1});
 const good=auditLoop(c,'idle');
 assert.equal(good.ok,true,good.errors.join('; '));
 assert.ok(good.metrics.samples>=120);
 assert.equal(good.metrics.cycles,2);
 m.animations[0].tracks.push({part:'body',property:'position',keys:[{time:0,value:[0,0]},{time:1,value:[400,0]},{time:2,value:[0,0]}]});
 const bad=auditLoop(compileCutout(doc,m,{revision:2}),'idle');
 assert.equal(bad.ok,false,'unexpected acceptance of 400px/second body motion');
 assert.ok(bad.errors.some(e=>/step|velocity|position/.test(e)),JSON.stringify(bad));
});
