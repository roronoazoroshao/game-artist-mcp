import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectR9dPaintPng} from '../src/ai-art/r9d-paint-intake.mjs';

const fail=(reason)=>{throw Error('R9D_ACQUISITION_REJECTED: '+reason)};
const EXACT_URL='https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a273eef3-2e12-49ef-8204-bad3ce001af1';
const GENERATION_ID='61fee9ba-8db0-4762-b0df-1cdcea5c6ae0';
const CUTOUT_ID='7b0708a3-4273-4dfa-928d-647b6474db28';

export function assertR9dAcquisitionRecord(op){
 if(!op||typeof op!=='object'||Array.isArray(op)||
    op.partId!=='body'||op.cutoutOutputUrl!==EXACT_URL||
    op.generationRequestId!==GENERATION_ID||
    op.cutoutRequestId!==CUTOUT_ID||
    op.cutoutMimeType!=='image/png'||
    op.outputCanvas?.width!==1360||op.outputCanvas?.height!==1744||
    op.commercialRightsCleared!==false||op.exportAllowed!==false||
    op.sourcePngStored!==false||op.sourcePngSha256!==null||
    op.sourcePngByteInspected!==false||op.rigPlacementVerified!==false||
    op.artisticReview!=='UNSCORED')
  fail('unexpected provider URL, dimensions or source/rights claims');
 return Object.freeze({partId:'body',url:EXACT_URL});
}

export async function probe(){
 const folder=resolve('.r9d-source-probe');
 await mkdir(folder,{recursive:true,mode:0o700});
 const report={phase:'R9D_PROVIDER_PNG_FETCH',partId:'body',
  sourceCustody:'NOT_ESTABLISHED',sourceAuthenticated:false,
  commercialRightsCleared:false,rigAligned:false,artisticReview:'UNSCORED',
  exportAllowed:false};
 try{
  const manifest=JSON.parse(await readFile(
   new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
  const op=manifest.operations.find(x=>x.partId==='body');
  const {url}=assertR9dAcquisitionRecord(op);
  const path=resolve(folder,'body-provider-cutout.png');
  // No shell, redirects require HTTPS, limited size and time; actual SHA/alpha
  // is independently checked after transport. Redirects could go through the
  // provider's CDN and are never treated as a provider signature.
  execFileSync('curl',[
   '--fail','--silent','--show-error','--location',
   '--proto','=https','--proto-redir','=https',
   '--max-redirs','5','--max-time','45','--connect-timeout','15',
   '--max-filesize','4194304','--output',path,url
  ],{timeout:55000,stdio:['ignore','pipe','pipe']});
  const st=await stat(path);
  if(st.size>4194304)fail('provider response exceeds 4MiB source bound');
  const bytes=await readFile(path);
  const evidence={
   schemaVersion:1,partId:'body',provider:'Adobe Firefly',
   generationRequestId:GENERATION_ID,cutoutRequestId:CUTOUT_ID,
   cutoutOutputUrl:url,cutoutDimensions:{width:1360,height:1744},
   commercialRightsCleared:false,rigAligned:false,
   exportAllowed:false,artisticReview:'UNSCORED'
  };
  const inspected=inspectR9dPaintPng({bytes,evidence});
  Object.assign(report,{sourceCustody:'VALIDATED_RUN_ARTIFACT_NOT_GIT',
   sourceSha256:inspected.sourceSha256,bytes:st.size,
   canvas:[inspected.width,inspected.height],
   transparentPixels:inspected.transparentPixels,
   partialAlphaPixels:inspected.partialAlphaPixels,
   verifiedPng:true,sourceAuthenticated:false});
  console.log('R9D_REAL_ADOBE_PNG_BYTES_VALIDATED_IN_RUNNER');
  console.log(JSON.stringify(report));
 }catch(err){
  report.error=String(err?.message??err).slice(0,480);
  report.sourceCustody='NOT_ESTABLISHED';
  console.error('R9D_REAL_ADOBE_PNG_NOT_RETRIEVED');
  console.error(report.error);
  await writeFile(resolve(folder,'diagnostic.json'),JSON.stringify(report,null,2)+'\n');
  throw err;
 }
 await writeFile(resolve(folder,'diagnostic.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await probe();
