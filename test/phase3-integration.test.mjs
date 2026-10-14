import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
test('Phase 3 real child MCP builds valid immutable atlas-backed Godot project',async()=>{
 const process=spawnSync(globalThis.process.execPath,['scripts/phase3-godot.mjs'],{
  encoding:'utf8',timeout:100000,maxBuffer:8*1024*1024
 });
 assert.equal(process.status,0,'Phase3 MCP export failed '+process.stderr+' '+process.stdout);
 assert.equal(JSON.parse(process.stdout).ok,true);
 const root='examples/spirit-lantern/generated/phase3-godot';
 for(const path of ['project.godot','main.tscn','validation.gd',
   'assets/spirit_lantern/atlas.png','assets/spirit_lantern/atlas.json',
   'assets/spirit_lantern/spirit_lantern.tscn']){
  const file=await stat(join(root,path));assert.ok(file.isFile()&&file.size>0,path);
 }
 const a=JSON.parse(await readFile(join(root,'assets/spirit_lantern/atlas.json'),'utf8'));
 assert.ok(a.atlasWidth<=2048&&a.atlasHeight<=2048);
 assert.ok(a.regions.filter(x=>x.partId==='flame').length>=5);
 const gd=await readFile(join(root,'assets/spirit_lantern/spirit_lantern.tscn'),'utf8');
 assert.match(gd,/Sprite2D:texture/);
 assert.match(gd,/SpiritLight:energy/);
 // R7: the exported bundle must include an *inspectable and playable* world,
 // not just the CI-only scene that exits after checking the atlas.
 for(const extra of ['showcase.tscn','showcase_world.gd','showcase_capture.gd']){
  const file=await stat(join(root,extra));
  assert.ok(file.isFile()&&file.size>300,'missing authored R7 scene resource '+extra);
 }
 const showcase=await readFile(join(root,'showcase.tscn'),'utf8');
 const world=await readFile(join(root,'showcase_world.gd'),'utf8');
 const capture=await readFile(join(root,'showcase_capture.gd'),'utf8');
 assert.match(showcase,/res:\/\/assets\/spirit_lantern\/spirit_lantern.tscn/);
 assert.match(showcase,/name="Lantern"/);
 assert.match(showcase,/name="Ground"/);
 assert.match(showcase,/name="Foreground"/);
 // The generated demo is intended for artists to open and press F6/F5;
 // project default must be playable, not the validation scene that quits.
 const project=await readFile(join(root,'project.godot'),'utf8');
 assert.match(project,/run\/main_scene="res:\/\/showcase.tscn"/);
 assert.match(world,/func _draw\(\) -> void:/);
 assert.match(world,/draw_colored_polygon/);
 assert.match(world,/draw_polyline/);
 assert.match(capture,/--capture-showcase/);
 assert.match(capture,/get_viewport\(\).get_texture\(\).get_image\(\)/);
 assert.match(capture,/GAME_ARTIST_R7_SHOWCASE_OK/);
 // R7.1: the cinematic background must be a real imported Godot shader
 // so fog/noise/vignette are rendered by the engine, not post-processed PNGs.
 const atmosphere=await readFile(join(root,'showcase_atmosphere.gdshader'),'utf8');
 assert.match(atmosphere,/shader_type canvas_item;/);
 assert.match(atmosphere,/float fbm\(/);
 assert.match(atmosphere,/COLOR = vec4/);
 assert.match(showcase,/type="ShaderMaterial"/);
 assert.match(showcase,/name="Atmosphere"/);
});
