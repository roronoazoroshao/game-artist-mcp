import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectR9dPaintPng} from '../src/ai-art/r9d-paint-intake.mjs';

const fail=(reason)=>{throw Error('R9D_ACQUISITION_REJECTED: '+reason)};
const ALLOWLIST=Object.freeze({
  "body": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a273eef3-2e12-49ef-8204-bad3ce001af1",
    "generationRequestId": "61fee9ba-8db0-4762-b0df-1cdcea5c6ae0",
    "cutoutRequestId": "7b0708a3-4273-4dfa-928d-647b6474db28",
    "width": 1360,
    "height": 1744
  },
  "flame_a": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:f1cdeee3-fd98-41ac-b175-b808e073d9f1",
    "generationRequestId": "b986e654-af24-478b-b726-e21c5c20c22a",
    "cutoutRequestId": "b9f99a01-aa30-4599-b0fe-e4a04235059e",
    "width": 2304,
    "height": 1792
  },
  "flame_b": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:842d7c49-0ec0-41f2-9f04-2d61ff58874d",
    "generationRequestId": "68f24a01-3134-490c-89dc-3375d0d042ee",
    "cutoutRequestId": "ef0748cc-4df0-40be-9db2-64d1d2c444c1",
    "width": 1744,
    "height": 1360
  },
  "flame_c": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a8f9ebd9-7895-408e-8c24-8e737feff402",
    "generationRequestId": "11f1d216-6095-4480-9797-bd1d57a15f9b",
    "cutoutRequestId": "a337757d-fee3-4e3b-ae16-c6055538196c",
    "width": 1744,
    "height": 1360
  },
  "flame_d": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a66aeb87-bbb4-404c-8de8-56e8fb1fbb4e",
    "generationRequestId": "92ee41fb-37f0-4d4b-96c8-ce3b7e34586e",
    "cutoutRequestId": "82008694-2ae0-425d-bce5-d4cd253d91da",
    "width": 1744,
    "height": 1360
  },
  "talisman_left": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:31ac6c93-790a-4378-ae28-cb9b39465628",
    "generationRequestId": "cb4ae5b8-48f1-4e2e-8fd8-e99a1a819cac",
    "cutoutRequestId": "317b098b-0974-481d-8785-0d265f470da7",
    "width": 1360,
    "height": 1744
  },
  "talisman_right": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a4ba0dab-3e19-4856-b278-8ae1827f1bc6",
    "generationRequestId": "cda13412-12f9-41cc-b710-f39fc0b06d4a",
    "cutoutRequestId": "2d0691e7-b177-4987-bbdd-6f801631c76e",
    "width": 1360,
    "height": 1744
  },
  "tassel": {
    "url": "https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:a7acba06-db48-4d27-9fef-2d22fd2804b9",
    "generationRequestId": "01530b71-d25a-4e77-821a-3cb649c8a3a2",
    "cutoutRequestId": "be42be8c-fbc0-40ef-baf9-d3b5d5c21bbb",
    "width": 1360,
    "height": 1744
  }
});
const PARTS=Object.freeze(Object.keys(ALLOWLIST));

export function assertR9dAcquisitionRecord(op){
 const expected=ALLOWLIST[op?.partId];
 if(!expected||typeof op!=='object'||Array.isArray(op)||
    op.cutoutOutputUrl!==expected.url||
    op.generationRequestId!==expected.generationRequestId||
    op.cutoutRequestId!==expected.cutoutRequestId||
    op.cutoutMimeType!=='image/png'||
    op.outputCanvas?.width!==expected.width||
    op.outputCanvas?.height!==expected.height||
    op.commercialRightsCleared!==false||op.exportAllowed!==false||
    op.sourcePngStored!==false||op.sourcePngSha256!==null||
    op.sourcePngByteInspected!==false||op.rigPlacementVerified!==false||
    op.artisticReview!=='UNSCORED')
  fail('unexpected provider URL, dimensions or source/rights claims');
 return Object.freeze({partId:op.partId,url:expected.url});
}

export async function probe(){
 const folder=resolve('.r9d-source-probe');
 await mkdir(folder,{recursive:true,mode:0o700});
 const report={phase:'R9D_PROVIDER_EIGHT_PNG_FETCH',
  sourceCustody:'NOT_ESTABLISHED',sourceAuthenticated:false,
  commercialRightsCleared:false,rigAligned:false,artisticReview:'UNSCORED',
  exportAllowed:false,assetId:'spirit_lantern',parts:[]};
 try{
  const manifest=JSON.parse(await readFile(
   new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'));
  if(!Array.isArray(manifest.operations)||manifest.operations.length!==PARTS.length||
   manifest.operations.some((o,i)=>o.partId!==PARTS[i]))
   fail('manifest has missing or reordered canonical paint parts');
  const bytesByPose=new Map();
  for(const op of manifest.operations){
   const {partId,url}=assertR9dAcquisitionRecord(op);
   const path=resolve(folder,partId+'.png');
   execFileSync('curl',[
    '--fail','--silent','--show-error','--location',
    '--proto','=https','--proto-redir','=https',
    '--max-redirs','5','--max-time','45','--connect-timeout','15',
    '--max-filesize','4194304','--output',path,url
   ],{timeout:55000,stdio:['ignore','pipe','pipe']});
   const st=await stat(path);
   if(st.size>4194304)fail('provider response exceeds 4MiB bound for '+partId);
   const bytes=await readFile(path);
   const evidence={
    schemaVersion:1,partId:partId.startsWith('flame_')?'flame':partId,
    provider:'Adobe Firefly',generationRequestId:op.generationRequestId,
    cutoutRequestId:op.cutoutRequestId,cutoutOutputUrl:url,
    cutoutDimensions:op.outputCanvas,
    commercialRightsCleared:false,rigAligned:false,
    exportAllowed:false,artisticReview:'UNSCORED'
   };
   const inspected=inspectR9dPaintPng({bytes,evidence});
   report.parts.push({id:partId,sha256:inspected.sourceSha256,
    bytes:st.size,canvas:[inspected.width,inspected.height],
    transparentPixels:inspected.transparentPixels,
    partialAlphaPixels:inspected.partialAlphaPixels,byteInspected:true});
   if(partId.startsWith('flame_'))bytesByPose.set(partId,bytes);
   console.log('R9D_ACTUAL_RGBA_VALIDATED '+partId+' '+inspected.sourceSha256);
  }
  const {inspectR9dFlamePoseSet}=await import('../src/ai-art/r9d-flame-diversity.mjs');
  const variance=inspectR9dFlamePoseSet(bytesByPose);
  report.flamePoseDiversity={
   status:variance.status,adjacentDifferences:variance.adjacentDifferences};
  report.sourceCustody='VALIDATED_RUN_ARTIFACT_NOT_GIT';
  report.byteCount=report.parts.length;
  console.log('R9D_EIGHT_REAL_ADOBE_PNG_BYTES_VALIDATED_IN_RUNNER');
 }catch(err){
  report.error=String(err?.message??err).slice(0,480);
  report.sourceCustody='INCOMPLETE';
  console.error('R9D_REAL_ADOBE_PNG_SET_NOT_VERIFIED');
  console.error(report.error);
  await writeFile(resolve(folder,'diagnostic.json'),JSON.stringify(report,null,2)+'\n');
  throw err;
 }
 await writeFile(resolve(folder,'diagnostic.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await probe();
