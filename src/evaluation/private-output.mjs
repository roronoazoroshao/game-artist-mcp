import {lstat,realpath} from 'node:fs/promises';
import {basename,dirname,resolve,sep} from 'node:path';

// Canonicalize the prospective path, including already-existing ancestors.
async function canonicalProspectivePath(path){
 let cursor=resolve(path);
 const missing=[];
 for(;;){
  try{return resolve(await realpath(cursor),...missing.reverse());}
  catch(error){
   if(error.code!=='ENOENT')throw error;
   const parent=dirname(cursor);
   if(parent===cursor)throw new Error('cannot resolve private review output root');
   missing.push(basename(cursor));cursor=parent;
  }
 }
}

/**
 * Narrow official-freeze threat model: a single trusted operator, with no
 * hostile same-UID or privileged concurrent filesystem mutation. A newly
 * named session must be placed under a pre-existing operator-owned 0700
 * directory. This is NOT a descriptor-relative, adversarial-TOCTOU guarantee.
 */
export async function assertPrivateReviewOutput({outputRoot,repositoryRoot}){
 const output=resolve(outputRoot);
 const [repo,target]=await Promise.all([realpath(repositoryRoot),canonicalProspectivePath(output)]);
 if(target===repo||target.startsWith(repo+sep))throw new Error('private reviewer session must be outside tracked repo');
 const parent=dirname(output);
 let st,parentReal;
 try{
  [st,parentReal]=await Promise.all([lstat(parent),realpath(parent)]);
 }catch{throw new Error('private session parent must already exist as a secure owner-only directory');}
 if(!st.isDirectory()||st.isSymbolicLink()||parentReal!==parent)throw new Error('private session parent must be a real owner-only directory (no symlinks)');
 if(typeof process.getuid==='function'&&st.uid!==process.getuid())throw new Error('private session parent must be owned by the operator');
 if((st.mode&0o077)!==0)throw new Error('private session parent permissions must be 0700 (no group/other access)');
 try{await lstat(output);}catch(error){
  if(error.code==='ENOENT')return target;
  throw error;
 }
 throw new Error('private review output session already exists; use a new unique session');
}
