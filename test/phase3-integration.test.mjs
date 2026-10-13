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
});
