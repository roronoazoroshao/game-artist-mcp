#!/usr/bin/env node
import {mkdtemp,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {freezeSourceSession,preflightSession} from '../src/evaluation/preflight.mjs';
import {buildOfflineReviewKit} from '../src/evaluation/review-kit.mjs';
import {assertCleanMainCheckout} from '../src/evaluation/source-checkout.mjs';
import {assertPrivateReviewOutput} from '../src/evaluation/private-output.mjs';
import {parseEvaluationJson,canonicalBytes,sha256Bytes} from '../src/evaluation/contracts.mjs';
import {readBoundedFile,writeAtomicFile} from '../src/evaluation/safe-io.mjs';
import {checkEligibility} from '../src/evaluation/reviewers.mjs';
import {validateHumanSubmission,stageSubmission} from '../src/evaluation/submissions.mjs';
import {lockReview,revealMapping} from '../src/evaluation/locking.mjs';
import {scoreVisual} from '../src/evaluation/verdict.mjs';
import {buildPrivateReport,redactPublicReport} from '../src/evaluation/reports.mjs';
const args=process.argv.slice(2),command=args.shift();
const option=(k,fallback)=>{const n=args.indexOf('--'+k);return n<0?fallback:args[n+1];};
const now=()=>new Date().toISOString();
const sha=()=>execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const input=async p=>parseEvaluationJson(await readFile(resolve(p),'utf8'));
async function load(root){
 const session=parseEvaluationJson((await readBoundedFile({root,relativePath:'internal/session.json',maxBytes:500000})).toString());
 const publicManifest=parseEvaluationJson((await readBoundedFile({root,relativePath:'review/manifest.json',maxBytes:500000})).toString());
 const privateMapping=parseEvaluationJson((await readBoundedFile({root,relativePath:'internal/sealed-mapping.json',maxBytes:20000})).toString());
 return {session,publicManifest,privateMapping,root};
}
async function runFreeze(root,sessionId,sourceSha,quorum){
 const r=await freezeSourceSession({sessionId,sourceCommitSha:sourceSha,reviewQuorum:quorum,rendererVersion:'rsvg-convert version 2.58.0',styleProfileId:'dark-cultivation-v1',createdAt:now(),frozenAt:now(),outputRoot:root});
 const v=await preflightSession({...r,rerender:true});
 if(v.technicalStatus!=='TECHNICAL_PASS')throw new Error('TECHNICAL_NO_GO: '+v.errors.join('; '));
 return r;
}
async function runDry(){
 const tmp=await mkdtemp(join(tmpdir(),'poc005c1-dry-'));
 try{
  const r=await runFreeze(tmp,'ci-uns cored'.replaceAll(' ',''),sha(),1);
  const out=resolve('benchmarks/poc005c1/generated/review');
  await rm(out,{recursive:true,force:true});
  const kit=await buildOfflineReviewKit({publicManifest:r.publicManifest,publicAssetRoot:join(tmp,'review'),outputDir:out});
  const report=buildPrivateReport({session:r.session,preflight:{technicalStatus:'TECHNICAL_PASS'},reviewLock:null,reveal:null,verdict:{visualStatus:'REVIEW_PENDING',failures:['BLOCKED: INDEPENDENT_REVIEWER']},advice:{kind:'ADVISORY_ONLY',status:'AI_TRIAGE_UNAVAILABLE'},evaluatorId:'ci',createdAt:now(),evidenceKind:'UNSCORED'});
  console.log(JSON.stringify({...redactPublicReport(report),kitFileCount:kit.files.length}));
 }finally{await rm(tmp,{recursive:true,force:true});}
}
async function run(){
 if(command==='dry'){await runDry();return;}
 if(command==='freeze'){
  const out=option('out',null);const quorum=Number(option('quorum','0'));
  if(!out||![1,2].includes(quorum))throw new Error('freeze --out ROOT --quorum 1|2');
  const sourceRepo=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const root=await assertPrivateReviewOutput({outputRoot:resolve(out),repositoryRoot:sourceRepo});
  const sourceSha=option('source-sha',sha());
  assertCleanMainCheckout({cwd:sourceRepo,expectedSha:sourceSha});
  const r=await runFreeze(root,option('session-id',''),sourceSha,quorum);
  const kit=await buildOfflineReviewKit({publicManifest:r.publicManifest,publicAssetRoot:join(root,'review'),outputDir:join(root,'reviewer-kit')});
  console.log(JSON.stringify({sessionId:r.session.sessionId,technicalStatus:'TECHNICAL_PASS',visualStatus:'REVIEW_PENDING',kitRoot:kit.kitRoot,kitDigest:kit.kitDigest}));return;
 }
 const root=resolve(option('session',''));
 if(!root||!option('session',null))throw new Error('command requires --session ROOT');
 const r=await load(root);
 const preflight=await preflightSession({...r,rerender:true});
 if(command==='validate'){console.log(JSON.stringify({...preflight,sessionId:r.session.sessionId}));return;}
 if(preflight.technicalStatus!=='TECHNICAL_PASS')throw new Error('TECHNICAL_NO_GO: '+preflight.errors.join('; '));
 if(command==='submit'){
  const raw=await input(option('submission',''));
  const verification=await input(option('verification',''));
  const x=validateHumanSubmission({rawSubmission:raw,session:r.session,publicManifest:r.publicManifest});
  const reviewerRecord={reviewerId:x.reviewerId,...x.reviewerDeclaration};
  const eligible=checkEligibility({reviewerRecord,session:r.session,independentVerification:verification});
  if(!eligible.eligible)throw new Error('REVIEW_PENDING: '+eligible.reason);
  if(x.evidenceKind==='SYNTHETIC_TEST')throw new Error('synthetic test cannot be accepted as an independent human');
  const receipt=await stageSubmission({submission:x,eligibility:eligible,privateRoot:join(root,'internal')});
  await writeAtomicFile({root:join(root,'internal'),relativePath:'eligibility/'+receipt.reviewerId+'.json',content:canonicalBytes(eligible)});
  console.log(JSON.stringify({reviewerId:receipt.reviewerId,staged:true,visualStatus:'REVIEW_PENDING',sha256:receipt.sha256}));return;
 }
 if(command==='decide'){
  const dir=join(root,'internal');
  const ids=await readdir(join(dir,'submissions')).catch(()=>[]);
  if(ids.length!==r.session.reviewQuorum){console.log(JSON.stringify({visualStatus:'REVIEW_PENDING',independentReviewerCount:ids.length,reason:'review quorum missing'}));return;}
  const submissions=[],verifiedEligibility=[];
  for(const name of ids){
   if(!/^[a-zA-Z0-9_-]+\.json$/.test(name))throw new Error('invalid submission filename');
   const s=parseEvaluationJson((await readBoundedFile({root:dir,relativePath:'submissions/'+name,maxBytes:500000})).toString());
   submissions.push(validateHumanSubmission({rawSubmission:s,session:r.session,publicManifest:r.publicManifest}));
   const e=parseEvaluationJson((await readBoundedFile({root:dir,relativePath:'eligibility/'+s.reviewerId+'.json',maxBytes:10000})).toString());
   verifiedEligibility.push(e);
  }
  const session={...r.session,state:'COLLECTING'};
  const lockedAt=option('locked-at',now()),revealedAt=option('revealed-at',now());
  const lock=await lockReview({session,submissions,verifiedEligibility,evaluatorId:option('evaluator-id','operator'),lockedAt,privateRoot:dir});
  const sourceRoleHashes={};
  for(const f of r.session.blindedFiles){
   const role=r.privateMapping.mapping[f.asset][f.label];
   sourceRoleHashes[f.asset]??={};sourceRoleHashes[f.asset][role]??={};
   sourceRoleHashes[f.asset][role][f.size]=f.sha256;
  }
  const reveal=await revealMapping({session:r.session,reviewLock:lock,sealedMapping:r.privateMapping,sourceRoleHashes,actorId:option('evaluator-id','operator'),revealedAt});
  const verdict=scoreVisual({session:r.session,lockedReviews:submissions,mappingReveal:reveal});
  const report=buildPrivateReport({session:r.session,preflight,reviewLock:lock,reveal,verdict,advice:{kind:'ADVISORY_ONLY',status:'AI_TRIAGE_UNAVAILABLE'},evaluatorId:option('evaluator-id','operator'),createdAt:now(),evidenceKind:'HUMAN_REVIEW',verifiedEligibility});
  await writeAtomicFile({root:dir,relativePath:'final-report.json',content:canonicalBytes(report)});
  await writeAtomicFile({root:dir,relativePath:'public-report.json',content:canonicalBytes(redactPublicReport(report))});
  console.log(JSON.stringify({visualStatus:report.visualStatus,technicalStatus:report.technicalStatus,liveVisualGoClaim:report.liveVisualGoClaim,independentReviewerCount:report.independentReviewerCount}));return;
 }
 throw new Error('use dry|freeze|validate|submit|decide');
}
run().catch(e=>{console.error('POC005C1: '+e.message);process.exitCode=1;});
