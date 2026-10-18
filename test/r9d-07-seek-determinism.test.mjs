import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Godot A/B screenshots pause the real AnimationPlayer before asynchronous framebuffer seeks',async()=>{
 for(const relative of ['../scripts/r9d-motion-capture.gd','../scripts/r9d-07-temporal-capture.gd']){
  const source=await readFile(new URL(relative,import.meta.url),'utf8');
  assert.match(source,/player\.play\("idle"\)\s+player\.pause\(\)\s+for /,
   relative+' must pause before first seek (frame_post_draw yields to Godot runtime)');
  assert.match(source,/player\.seek\([^)]+, true\)/,
   relative+' must drive each capture from explicit animation time');
 }
});
