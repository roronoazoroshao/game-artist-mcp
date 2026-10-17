import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectAiPng} from '../src/ai-art/png-intake.mjs';
import {createR9dCustodyLedger} from '../src/ai-art/r9d-source-custody.mjs';

const root=resolve('.r9d-source-probe');
const catalog=resolve('examples/spirit-lantern/r9d/parts/sources');
const registry=JSON.parse(await readFile(
 new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
const report=JSON.parse(await readFile(resolve(root,'diagnostic.json'),'utf8'));
const custody=createR9dCustodyLedger({registry,report});
for(const item of custody.sources){
 const source=resolve(root,item.partId+'.png');
 const data=await readFile(source);
 const sha=createHash('sha256').update(data).digest('hex');
 const info=inspectAiPng(data);
 if(data.length!==item.bytes||sha!==item.sha256||
    info.width!==item.canvas[0]||info.height!==item.canvas[1]||
    info.sourceSha256!==sha)
   throw Error('R9D_CUSTODY_REJECTED: verified PNG modified '+item.partId);
 const target=resolve(item.path);
 if(!target.startsWith(catalog+'/'))throw Error('R9D_CUSTODY_REJECTED: unsafe source path');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 await copyFile(source,target);
 const checked=await stat(target);
 if(checked.size!==item.bytes)throw Error('R9D_CUSTODY_REJECTED: source copy incomplete');
}
await writeFile(resolve(catalog,'source-custody-001.json'),JSON.stringify(custody,null,2)+'\n');
console.log('R9D_EIGHT_IMMUTABLE_PNG_SOURCES_READY_FOR_GIT');
console.log(JSON.stringify({parts:custody.sources.map(s=>({partId:s.partId,sha256:s.sha256})),
 sourceAuthentication:custody.sourceAuthentication,artisticReview:custody.artisticReview,
 exportAllowed:custody.exportAllowed}));
