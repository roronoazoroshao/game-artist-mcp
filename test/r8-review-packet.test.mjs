import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const script=new URL('../scripts/r8-review-packet.mjs',import.meta.url);
const sha=x=>x.repeat(40);
const exec=args=>spawnSync(process.execPath,[script.pathname,...args],{encoding:'utf8'});
const params=(base,candidate,out)=>['--baseline-dir',base,'--candidate-dir',candidate,'--baseline-sha',sha('a'),'--candidate-sha',sha('b'),'--output',out];
async function png(dir,index,c){
 const p=new PNG({width:512,height:512,colorType:6});
 for(let i=0;i<p.data.length;i+=4){p.data[i]=c;p.data[i+1]=c+4;p.data[i+2]=c+7;p.data[i+3]=255;}
 await writeFile(join(dir,'frame-'+String(index).padStart(2,'0')+'.png'),PNG.sync.write(p));
}
test('R8d review packet refuses false baseline and enforces unscored original-frame provenance',async()=>{
 const file=await readFile(script,'utf8');
 assert.match(file,/UNSCORED/);
 const dir=await mkdtemp(join(tmpdir(),'r8-review-test-'));
 try{
  const base=join(dir,'base'),candidate=join(dir,'candidate'),out=join(dir,'out');
  await mkdir(base);await mkdir(candidate);
  const same=exec(params(base,base,out));
  assert.notEqual(same.status,0,'mislabeled identical baseline/candidate inputs accepted');
  const missing=exec(params(base,candidate,out));
  assert.notEqual(missing.status,0,'missing real Godot screenshot accepted');
  for(let i=0;i<4;i++){await png(base,i,52+i);await png(candidate,i,78+i);}
  const bad=exec([...params(base,candidate,out).slice(0,5),'not-a-git-sha',...params(base,candidate,out).slice(6)]);
  assert.notEqual(bad.status,0,'invalid exact source SHA accepted');
  const ok=exec(params(base,candidate,out));
  assert.equal(ok.status,0,ok.stderr+' '+ok.stdout);
  const data=JSON.parse(await readFile(join(out,'review.json'),'utf8'));
  assert.equal(data.reviewStatus,'UNSCORED');
  assert.equal(data.baselineSha,sha('a'));
  assert.equal(data.candidateSha,sha('b'));
  assert.equal(data.frames.length,4);
  assert.ok(!Object.hasOwn(data,'score')&&!Object.hasOwn(data,'visualGo'));
  for(const size of [512,128,64]){
   const image=PNG.sync.read(await readFile(join(out,'contact-'+size+'.png')),{checkCRC:true});
   assert.equal(image.width,size*8);
   assert.equal(image.height,size);
  }
  // Fail closed when candidate is pixel-identical to a deliberately mislabeled baseline.
  for(let i=0;i<4;i++)await png(candidate,i,52+i);
  const fake=exec(params(base,candidate,join(dir,'fake')));
  assert.notEqual(fake.status,0,'identical pixels presented as blind A/B variants');
 }finally{await rm(dir,{recursive:true,force:true});}
});
