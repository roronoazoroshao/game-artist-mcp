import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const files=[
 '../scripts/r9d-motion-capture.gd',
 '../scripts/r9d-06-compare.mjs',
 '../src/ai-art/r9d-motion-qa.mjs',
 '../test/r9d-motion-qa.test.mjs'
];
test('all three-scale A/B capture and auditor must explicitly sample the approved 105ms crossfade point',async()=>{
 for(const file of files){
  const text=await readFile(new URL(file,import.meta.url),'utf8');
  const matcher=file.endsWith('.gd')?/0\.105\b/:/\b105\b/;
  assert.match(text,matcher,file+' omitted required 105ms frame');
 }
});
test('three-scale capture must require 15 independent sample instants per variant',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 const script=await readFile(new URL('../src/ai-art/r9d-motion-qa.mjs',import.meta.url),'utf8');
 const compare=await readFile(new URL('../scripts/r9d-06-compare.mjs',import.meta.url),'utf8');
 assert.match(workflow,/FIFTEEN_TIME_THREE_SCALE_CAPTURE_OK/);
 assert.match(script,/framesPerVariant:R9D06_TIMES\.length\*SIZES\.length/);
 assert.match(compare,/105/);
});
