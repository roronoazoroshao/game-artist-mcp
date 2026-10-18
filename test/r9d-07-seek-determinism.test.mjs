import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Godot A/B screenshots pause the real AnimationPlayer before asynchronous framebuffer seeks',async()=>{
 for(const relative of ['../scripts/r9d-motion-capture.gd','../scripts/r9d-07-temporal-capture.gd']){
  const source=await readFile(new URL(relative,import.meta.url),'utf8');
  const start=source.indexOf('player.play("idle")');
  const pause=source.indexOf('player.pause()',start);
  const firstSeek=source.indexOf('player.seek(',start);
  assert.ok(start>=0&&pause>start&&pause<firstSeek,
   relative+' must pause before first seek (frame_post_draw yields to Godot runtime)');
  assert.match(source,/player\.seek\([^)]+, true\)/,
   relative+' must drive each capture from explicit animation time');
 }
});
