import test from 'node:test';
import assert from 'node:assert/strict';
import {chmod,lstat,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assertPrivateReviewOutput} from '../src/evaluation/private-output.mjs';

test('private freeze accepts only a new output under an existing owner-only parent',async()=>{
 const base=await mkdtemp(join(tmpdir(),'c1-private-owner-'));
 try{
  const repo=join(base,'repo'),parent=join(base,'sessions');
  await mkdir(repo);await mkdir(parent,{mode:0o700});
  const out=join(parent,'session-01');
  assert.equal(await assertPrivateReviewOutput({outputRoot:out,repositoryRoot:repo}),out);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('private freeze refuses writable-by-others parent even when lexical path is external',async()=>{
 const base=await mkdtemp(join(tmpdir(),'c1-private-perms-'));
 try{
  const repo=join(base,'repo'),parent=join(base,'shared');
  await mkdir(repo);await mkdir(parent);
  await chmod(parent,0o777);
  await assert.rejects(
   assertPrivateReviewOutput({outputRoot:join(parent,'session'),repositoryRoot:repo}),
   /private|owner|permission|secure|0700|writable/i
  );
 }finally{await rm(base,{recursive:true,force:true});}
});
test('private freeze refuses missing private parent instead of silently creating it',async()=>{
 const base=await mkdtemp(join(tmpdir(),'c1-private-missing-'));
 try{
  const repo=join(base,'repo');await mkdir(repo);
  await assert.rejects(
   assertPrivateReviewOutput({outputRoot:join(base,'missing','session'),repositoryRoot:repo}),
   /private|owner|permission|parent|missing/i
  );
 }finally{await rm(base,{recursive:true,force:true});}
});
test('private freeze refuses reusing an existing output session directory',async()=>{
 const base=await mkdtemp(join(tmpdir(),'c1-private-reuse-'));
 try{
  const repo=join(base,'repo'),parent=join(base,'private');
  await mkdir(repo);await mkdir(parent,{mode:0o700});await mkdir(join(parent,'session'));
  await assert.rejects(
   assertPrivateReviewOutput({outputRoot:join(parent,'session'),repositoryRoot:repo}),
   /exist|reuse|fresh|new|private/i
  );
 }finally{await rm(base,{recursive:true,force:true});}
});
