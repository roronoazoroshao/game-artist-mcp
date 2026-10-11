import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildProvenanceReport,redactProvenanceReport,aggregateProvenanceRuns} from '../src/provenance/report.mjs';
import {challengeFixture} from './fixtures/provenance-fixtures.mjs';
const caps={providerReceiptSupported:false,hostReceiptSupported:false,strictProviderGate:'BLOCKED'};
const workflow={status:'UNDETERMINED',technicalStatus:'TECHNICAL_PASS',reasons:['SEMANTIC_GROUNDING_UNVERIFIED'],metrics:{toolCalls:9,renderCount:2,correctionRounds:1,elapsedMs:25000}};
const baseline=()=>buildProvenanceReport({challenge:challengeFixture,capabilities:caps,attestations:[{signature:'Authorization Bearer VERY_SECRET',issuerRef:'OpenAI'}],events:[],workflow});
test('missing authentic provider receipt preserves independent status axes',()=>{
 const result=baseline();assert.equal(result.provenanceStatus,'UNVERIFIED');assert.equal(result.workflowStatus,'UNDETERMINED');assert.equal(result.technicalStatus,'TECHNICAL_PASS');assert.equal(result.visualStatus,'VISUAL_REVIEW_PENDING');
 assert.ok(result.reasons.includes('AGENT_PROVENANCE_PENDING'));
});
test('public report excludes raw receipts, PII, bearer tokens and challenge plaintext',()=>{
 const result=redactProvenanceReport({...baseline(),authHeader:'Bearer secret',privateBrief:'held-out hidden prompt',userEmail:'a@example.com'});
 const rendered=JSON.stringify(result);
 for(const secret of ['VERY_SECRET','Bearer','held-out hidden prompt','a@example.com','signature','authHeader'])assert.ok(!rendered.includes(secret));
 assert.equal(result.visualStatus,'VISUAL_REVIEW_PENDING');
});
test('three-run aggregate rejects missing, duplicate, partial and synthetic receipts',()=>{
 const report=baseline();
 for(const reports of [[report],[report,report,report],[]]){
  assert.equal(aggregateProvenanceRuns({reports,expectedChallengeIds:['c1','c2','c3']}).strictProviderGo,false);
 }
 const arr=['c1','c2','c3'].map(challengeId=>({...report,challengeId,evidenceKind:'SYNTHETIC_TEST',provenanceStatus:'PROVIDER_ATTESTED'}));
 assert.equal(aggregateProvenanceRuns({reports:arr,expectedChallengeIds:['c1','c2','c3']}).strictProviderGo,false);
});
test('CLI documents offline operation without inference call',()=>{
 const run=spawnSync(process.execPath,['scripts/poc005c2-audit.mjs','--help'],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/--session/);assert.match(run.stdout,/--policy/);
});
test('CLI rejects symlinked session evidence, no secrets echoed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'poc005c2-security-'));
 try{
  await mkdir(join(dir,'session'),{mode:0o700});
  await writeFile(join(dir,'real.json'),'{}');
  await symlink(join(dir,'real.json'),join(dir,'session','challenge.json'));
  await writeFile(join(dir,'policy.json'),'{}');
  const run=spawnSync(process.execPath,['scripts/poc005c2-audit.mjs','--session',join(dir,'session'),'--policy',join(dir,'policy.json'),'--public-out',join(dir,'public.json')],{cwd:process.cwd(),encoding:'utf8'});
  assert.notEqual(run.status,0);assert.ok(!run.stderr.includes('VERY_SECRET'));
  await assert.rejects(readFile(join(dir,'public.json')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
