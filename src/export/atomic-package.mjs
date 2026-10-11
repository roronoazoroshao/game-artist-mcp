import {createHash,randomBytes} from 'node:crypto';
import {open,readFile,writeFile,mkdir,mkdtemp,rename,rm,lstat,readdir} from 'node:fs/promises';
import {join,dirname,relative} from 'node:path';
import {canonicalBytes,sha256Bytes} from '../evaluation/contracts.mjs';
import {assertAssetId} from '../mcp/store.mjs';

const locks=new Map();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const safePath=(path,assetId)=>{
 const prefix='assets/'+assetId+'/';
 if(typeof path!=='string'||path.length>200||path.includes('\\')||path.includes('\0')||path.startsWith('/')||path.split('/').some(v=>v===''||v==='.'||v==='..'))return false;
 if(['project.godot','main.tscn','validation.gd'].includes(path))return true;
 if(!path.startsWith(prefix))return false;
 const sub=path.slice(prefix.length);
 return /^(?:atlas\.(?:png|json)|asset\.json|source\.json|cutout\.json|light\.svg|spirit_lantern\.tscn|sources\/[a-z][a-z0-9_]{0,63}\.svg)$/.test(sub);
};
async function checkDir(path,{optional=false}={}){
 try{
  const st=await lstat(path);
  if(st.isSymbolicLink()||!st.isDirectory())throw new Error('unsafe symlink or directory: '+path);
  return true;
 }catch(e){if(optional&&e.code==='ENOENT')return false;throw e}
}
async function checkFile(path,{optional=false}={}){
 try{const st=await lstat(path);if(st.isSymbolicLink()||!st.isFile())throw new Error('unsafe symlink or pointer file');return true}
 catch(e){if(optional&&e.code==='ENOENT')return false;throw e}
}
async function syncedFile(path,content){
 const h=await open(path,'wx',0o600);
 try{await h.writeFile(content);await h.sync()}finally{await h.close()}
}
async function flushDirectory(path){
 const h=await open(path,'r');
 try{await h.sync()}finally{await h.close()}
}
function validateFiles(files,assetId){
 if(!(files instanceof Map)||files.size<2||files.size>128||!files.has('project.godot')||!files.has('main.tscn'))throw new Error('invalid project package');
 let total=0;
 const entries=[];
 for(const [path,data] of files){
  if(!safePath(path,assetId))throw new Error('unsafe package path');
  const bytes=Buffer.isBuffer(data)?data:typeof data==='string'?Buffer.from(data,'utf8'):null;
  if(!bytes||bytes.length===0||bytes.length>8*1024*1024)throw new Error('invalid package byte budget');
  total+=bytes.length;
  if(total>32*1024*1024)throw new Error('invalid total package byte budget');
  entries.push({path,bytes,sha256:sha(bytes)});
 }
 entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const packageSha256=sha(Buffer.from(entries.map(e=>e.path+'\0'+e.sha256+'\n').join(''),'utf8'));
 return {entries,packageSha256};
}
async function currentVersionCheck(store,assetId,expectedRevision,sourceSha256){
 const state=await store.load(assetId);
 if(state.revision!==expectedRevision||sha256Bytes(canonicalBytes(state.document))!==sourceSha256)
  throw new Error('STALE_SOURCE_REVISION');
}
async function publishInner({store,assetId,expectedRevision,sourceSha256,files}){
 assertAssetId(assetId);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!/^[a-f0-9]{64}$/.test(sourceSha256??''))
  throw Error('STALE_SOURCE_REVISION');
 const {entries,packageSha256}=validateFiles(files,assetId);
 const assetDir=store.assetDir(assetId),versions=join(assetDir,'godot-versions');
 await checkDir(assetDir);
 await checkDir(versions,{optional:true});
 const pointer=join(assetDir,'godot-v2-current.json');
 await checkFile(pointer,{optional:true});
 await currentVersionCheck(store,assetId,expectedRevision,sourceSha256);
 if(!await checkDir(versions,{optional:true}))await mkdir(versions,{mode:0o700});
 await checkDir(versions);
 const target=join(versions,packageSha256);
 let staged=null,created=false;
 try{
  if(!await checkDir(target,{optional:true})){
   staged=await mkdtemp(join(assetDir,'.v2-staging-'));
   for(const entry of entries){
    const dest=join(staged,entry.path);
    await mkdir(dirname(dest),{recursive:true,mode:0o700});
    await syncedFile(dest,entry.bytes);
   }
   const fileManifest=entries.map(e=>({path:e.path,sha256:e.sha256,bytes:e.bytes.length}));
   await syncedFile(join(staged,'package-manifest.json'),JSON.stringify({packageSha256,files:fileManifest},null,2)+'\n');
   await flushDirectory(staged);
   try{await rename(staged,target);created=true;staged=null}catch(e){
    if(e.code!=='EEXIST'&&e.code!=='ENOTEMPTY')throw e;
   }
  }
  await checkDir(target);
  const expectedManifest=await readFile(join(target,'package-manifest.json'),'utf8');
  const parsed=JSON.parse(expectedManifest);
  if(parsed.packageSha256!==packageSha256||parsed.files.length!==entries.length)throw Error('package directory collision');
  for(let i=0;i<entries.length;i++){
   const entry=entries[i],meta=parsed.files[i];
   if(meta.path!==entry.path||meta.sha256!==entry.sha256||!await checkFile(join(target,entry.path)))throw Error('corrupted immutable package manifest');
   if(sha(await readFile(join(target,entry.path)))!==entry.sha256)throw Error('corrupted immutable package bytes');
  }
  await currentVersionCheck(store,assetId,expectedRevision,sourceSha256);
  const pointerData={schemaVersion:1,sourceRevision:expectedRevision,sourceSha256,packageSha256,project:'godot-versions/'+packageSha256};
  const tempPointer=join(assetDir,'.godot-v2-pointer-'+process.pid+'-'+randomBytes(8).toString('hex'));
  try{
   await syncedFile(tempPointer,JSON.stringify(pointerData,null,2)+'\n');
   await checkFile(pointer,{optional:true});
   await currentVersionCheck(store,assetId,expectedRevision,sourceSha256);
   await rename(tempPointer,pointer);
   await flushDirectory(assetDir);
  }finally{await rm(tempPointer,{force:true})}
  return {projectPath:target,packageSha256};
 }finally{if(staged)await rm(staged,{recursive:true,force:true})}
}
export async function publishGodotPackage(args){
 const key=args?.assetId??'';
 const previous=locks.get(key)??Promise.resolve();
 let release;
 const next=new Promise(resolve=>{release=resolve});
 locks.set(key,next);
 await previous;
 try{return await args.store.withAssetWriteLock(args.assetId,()=>publishInner(args))}
 finally{release();if(locks.get(key)===next)locks.delete(key)}
}
