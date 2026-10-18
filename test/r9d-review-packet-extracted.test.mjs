import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {verifyR9dReviewPacket} from '../src/ai-art/r9d-review-packet-verify.mjs';
const {PNG}=pngjs;
const HEAD='e0bcf74feb7a92f4717669eae5f34de6423079d2';
const ORA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const hash=b=>createHash('sha256').update(b).digest('hex');
const invalid=p=>assert.rejects(p,/R9D_REVIEW_PACKET_REJECTED/);
function image(size,frame){
 const p=new PNG({width:size,height:size});
 for(let i=0;i<p.data.length;i+=4){p.data[i]=i%251;p.data[i+1]=frame%255;p.data[i+2]=((i>>>4)+frame)%255;p.data[i+3]=255;}
 return PNG.sync.write(p);
}
async function make(root){
 const files={};
 const cached=new Map();
 for(const label of ['A','B']){
  for(const size of [64,128])for(let n=0;n<120;n++){
   const key=`variants/${label}/${size}/frame-${String(n).padStart(3,'0')}.png`;
   const bytes=image(size,n+(label==='A'?0:30));files[key]=hash(bytes);
   const target=join(root,key);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
  }
  for(let n=0;n<15;n++){
   const t=n*125,key=`variants/${label}/512-static/${String(t).padStart(4,'0')}.png`;
   const bytes=cached.get(label)||image(512,label==='A'?20:40);cached.set(label,bytes);files[key]=hash(bytes);
   const target=join(root,key);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
  }
 }
 const m={kind:'R10_BLIND_REVIEW_UNSCORED',sourceHead:HEAD,sourceRun:39117042663,
  sourceArtifactId:12133305348,sourceOraSha256:ORA,sealCommitmentSha256:'2'.repeat(64),
  sampling:'GODOT_DETERMINISTIC_120HZ_SEEK_EVEN_TICKS_FOR_60FPS_VIEWER',
  physicalDisplayTimingMeasured:false,exportAllowed:false,rightsVerified:false,
  humanReviewStatus:'PENDING',framesPerVariant60Hz:120,
  static512TimesMs:Array.from({length:15},(_,i)=>i*125),files};
 await writeFile(join(root,'manifest.json'),JSON.stringify(m));
 await writeFile(join(root,'scorecard-template.json'),JSON.stringify({
  reviewerDeclaration:null,packetZipSha256:null,preferredVariant:null,
  scores_1to5:{readability64:null,flameFluidity:null}}));
 await writeFile(join(root,'README.md'),'Reviewer-only synthetic test fixture. NO real reviewers.');
 const style='body{color:white}';
 const script="document.title='Blinded A B'";
 const sri=s=>createHash('sha256').update(s).digest('base64');
 const csp=`default-src 'none'; img-src 'self' data:; style-src 'sha256-${sri(style)}'; script-src 'sha256-${sri(script)}'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
 await writeFile(join(root,'viewer.html'),`<meta http-equiv="Content-Security-Policy" content="${csp}"><style>${style}</style><script>${script}</script><h1>Review A B</h1>`);
}
test('R9d extracted kit real decoded 510-PNG CRC, digest and side-channel controls',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r9d-kit-integrity-'));
 try{
  await make(root);
  const opts={root,expectedSourceHead:HEAD};
  const result=await verifyR9dReviewPacket(opts);
  assert.equal(result.verifiedPngCount,510);
  assert.equal(result.artisticReview,'REVIEW_PENDING');
  assert.equal(result.commercialRightsCleared,false);
  const imagePath=join(root,'variants/A/64/frame-000.png');
  await writeFile(imagePath,Buffer.from('not a valid png'));
  await invalid(verifyR9dReviewPacket(opts));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('R9d extracted kit blocks a browser viewer without restrictive offline CSP',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r9d-kit-csp-'));
 try{
  await make(root);
  const opts={root,expectedSourceHead:HEAD};
  await writeFile(join(root,'viewer.html'),'<h1>No security policy</h1>');
  await invalid(verifyR9dReviewPacket(opts));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('R9d offline viewer rejects injected executable script not covered by its CSP hash',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r9d-kit-injection-'));
 try{
  await make(root);
  const viewer=join(root,'viewer.html');
  const text=await readFile(viewer,'utf8');
  await writeFile(viewer,text.replace("document.title='Blinded A B'","document.title='Tampered A B'"));
  await invalid(verifyR9dReviewPacket({root,expectedSourceHead:HEAD}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('R9d extracted kit refuses extra sealed mapping or filesystem symlinks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r9d-kit-leak-'));
 try{
  await make(root);
  const opts={root,expectedSourceHead:HEAD};
  await mkdir(join(root,'internal'));
  await writeFile(join(root,'internal/sealed-mapping.json'),'secret');
  await invalid(verifyR9dReviewPacket(opts));
  await rm(join(root,'internal'),{recursive:true});
  await symlink(join(root,'manifest.json'),join(root,'unsafe-link.json'));
  await invalid(verifyR9dReviewPacket(opts));
 }finally{await rm(root,{recursive:true,force:true});}
});
