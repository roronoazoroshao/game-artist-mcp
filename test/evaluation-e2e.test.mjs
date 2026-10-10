import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync as execSpawnSync} from 'node:child_process';
import {readFile,readdir,mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
test('dry end-to-end creates only UNSCORED offline review kit and cannot certify live quality',async()=>{
 const output=execFileSync(process.execPath,['scripts/poc005c1-evaluate.mjs','dry'],{cwd:root,timeout:90000,encoding:'utf8'});
 const j=JSON.parse(output.trim().split('\n').at(-1));
 assert.equal(j.technicalStatus,'TECHNICAL_PASS');
 assert.equal(j.visualStatus,'REVIEW_PENDING');
 assert.equal(j.independentReviewerCount,0);
 const kit=join(root,'benchmarks/poc005c1/generated/review');
 const contents=await readdir(kit);
 assert.ok(contents.includes('review.html')&&contents.includes('manifest.json'));
 assert.equal(contents.some(x=>/internal|sealed|private|author/i.test(x)),false);
 const manifest=JSON.parse(await readFile(join(kit,'manifest.json'),'utf8'));
 assert.equal(manifest.files.length,12);
});
test('operator cannot freeze private reviewer records inside tracked repository or misstate source SHA',()=>{
 const {spawnSync}=requireShim();
 const base=[ 'scripts/poc005c1-evaluate.mjs','freeze','--session-id','blocked-freeze','--quorum','1','--source-sha','f'.repeat(40) ];
 const badRoot=spawnSync(process.execPath,[...base,'--out',root],{cwd:root,encoding:'utf8',timeout:20000});
 assert.notEqual(badRoot.status,0);assert.match(badRoot.stderr,/private|tracked|unsafe|source/i);
});
function requireShim(){return {spawnSync:execSpawnSync};}
test('CI only uploads safe review subtree',async()=>{
 const yml=await readFile(join(root,'.github/workflows/ci.yml'),'utf8');
 assert.match(yml,/name: poc-005c1-blind-review-UNSCORED[\s\S]*?path: benchmarks\/poc005c1\/generated\/review\//);
 assert.doesNotMatch(yml,/path:\s*benchmarks\/poc005c1\/generated\/\s*$/m);
 const ignore=await readFile(join(root,'.gitignore'),'utf8');
 assert.match(ignore,/benchmarks\/poc005c1\/generated\//);
});

test('freeze refuses an external symlink that resolves into the tracked repository before source checks',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'c1-private-path-'));
 try{
  const alias=join(temp,'outside-alias');
  await symlink(root,alias,'dir');
  const out=join(alias,'private-human-review');
  const result=execSpawnSync(process.execPath,[
   'scripts/poc005c1-evaluate.mjs','freeze','--session-id','symlink-blocked',
   '--quorum','1','--out',out,'--source-sha','f'.repeat(40)
  ],{cwd:root,encoding:'utf8',timeout:20000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/private reviewer session must be outside tracked repo/i);
 }finally{await rm(temp,{recursive:true,force:true});}
});
