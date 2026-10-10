import {realpath} from 'node:fs/promises';
import {basename,dirname,resolve,sep} from 'node:path';

// Resolve symlinks in every existing ancestor, including when the session root
// itself has not yet been created. This guards against accidental private data
// placement inside the tracked checkout via an external symlink alias.
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

export async function assertPrivateReviewOutput({outputRoot,repositoryRoot}){
 const [repo,target]=await Promise.all([realpath(repositoryRoot),canonicalProspectivePath(outputRoot)]);
 if(target===repo||target.startsWith(repo+sep))throw new Error('private reviewer session must be outside tracked repo');
 return target;
}
