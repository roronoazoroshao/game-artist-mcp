import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,symlink,writeFile,readdir,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AssetStore} from '../src/mcp/store.mjs';

async function runExport(root){
  const child=spawn(process.execPath,[resolve('src/mcp/server.mjs'),'--workspace',root],{
    stdio:['pipe','pipe','pipe']
  });
  let stdout='',stderr='';
  child.stdout.on('data',data=>{stdout+=data.toString('utf8')});
  child.stderr.on('data',data=>{stderr+=data.toString('utf8')});
  try{
    child.stdin.write(JSON.stringify({
      jsonrpc:'2.0',id:1,method:'tools/call',
      params:{name:'export_asset',arguments:{asset_id:'asset_one'}}
    })+'\n');
    return await new Promise((resolveResponse,reject)=>{
      const timeout=setTimeout(()=>{
        child.kill();
        reject(new Error('MCP export timed out: '+stderr))
      },12000);
      const poll=setInterval(()=>{
        const sep=stdout.indexOf('\n');
        if(sep<0)return;
        clearTimeout(timeout);clearInterval(poll);
        try{resolveResponse(JSON.parse(stdout.slice(0,sep)))}catch(e){reject(e)}
      },5);
      child.once('exit',(code)=>{
        clearTimeout(timeout);clearInterval(poll);
        reject(new Error('MCP exited '+code+' '+stderr))
      });
    });
  }finally{child.kill('SIGTERM')}
}

test('legacy export refuses symlinked output directory without external writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ga-r5-root-'));
 const outside=await mkdtemp(join(tmpdir(),'ga-r5-outside-'));
 try{
  const store=new AssetStore(root);
  await store.create('asset_one',64,64);
  await writeFile(join(outside,'asset.svg'),'SENTINEL','utf8');
  await symlink(outside,join(store.assetDir('asset_one'),'output'),'dir');
  const response=await runExport(root);
  assert.equal(response.result.isError,true,JSON.stringify(response.result));
  assert.equal(await readFile(join(outside,'asset.svg'),'utf8'),'SENTINEL');
  assert.deepEqual(await readdir(outside),['asset.svg']);
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
});

test('legacy export refuses symlinked output file without overwriting sentinel',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ga-r5-root-'));
 const outside=await mkdtemp(join(tmpdir(),'ga-r5-outside-'));
 try{
  const store=new AssetStore(root);
  await store.create('asset_one',64,64);
  const output=join(store.assetDir('asset_one'),'output');
  await mkdir(output);
  const sentinel=join(outside,'sentinel.svg');
  await writeFile(sentinel,'DO_NOT_CHANGE','utf8');
  await symlink(sentinel,join(output,'asset.svg'));
  const response=await runExport(root);
  assert.equal(response.result.isError,true,JSON.stringify(response.result));
  assert.equal(await readFile(sentinel,'utf8'),'DO_NOT_CHANGE');
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
});

test('legacy export replaces a preexisting hardlink without mutating its external inode',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ga-r5-root-'));
 const outside=await mkdtemp(join(tmpdir(),'ga-r5-outside-'));
 try{
  const store=new AssetStore(root);
  await store.create('asset_one',64,64);
  const output=join(store.assetDir('asset_one'),'output');
  await mkdir(output);
  const sentinel=join(outside,'sentinel.svg');
  await writeFile(sentinel,'HARDLINK_SENTINEL','utf8');
  await link(sentinel,join(output,'asset.svg'));
  const response=await runExport(root);
  assert.equal(response.result.isError,undefined,JSON.stringify(response.result));
  assert.equal(await readFile(sentinel,'utf8'),'HARDLINK_SENTINEL');
  assert.notEqual(await readFile(join(output,'asset.svg'),'utf8'),'HARDLINK_SENTINEL');
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
});
