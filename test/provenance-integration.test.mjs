import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {buildSyntheticWorkflow,challengeFixture,exportFixture} from './fixtures/provenance-fixtures.mjs';
import {auditArtWorkflow} from '../src/provenance/workflow-audit.mjs';
import {aggregateProvenanceRuns} from '../src/provenance/report.mjs';
test('synthetic complete chain cannot attain provider origin or human artistic GO',()=>{
 const wf=auditArtWorkflow({challenge:challengeFixture,events:buildSyntheticWorkflow(),exports:exportFixture});
 assert.equal(wf.technicalStatus,'TECHNICAL_PASS');assert.equal(wf.status,'UNDETERMINED');
 assert.equal(aggregateProvenanceRuns({reports:[{...wf,challengeId:'one',evidenceKind:'SYNTHETIC_TEST'}],expectedChallengeIds:['one','two','three']}).strictProviderGo,false);
});
test('CI has offline-only POC-005C2 steps, no private secrets or attestation uploads',async()=>{
 const workflow=await readFile('.github/workflows/ci.yml','utf8');
 assert.match(workflow,/npm run poc:005c2:capabilities/);
 assert.match(workflow,/npm run poc:005c2:audit:dry/);
 assert.doesNotMatch(workflow,/upload-artifact[^\n]*poc005c2|path:[^\n]*poc005c2|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
 const ig=await readFile('.gitignore','utf8');assert.match(ig,/benchmarks\/poc005c2\/generated\//);
});
test('package scripts run structurally correct dry rehearsal without paid model calls',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 assert.match(pkg.scripts['poc:005c2:capabilities'],/poc005c2-capabilities/);
 assert.match(pkg.scripts['poc:005c2:audit:dry'],/poc005c2-audit-dry/);
 const run=spawnSync(process.execPath,['scripts/poc005c2-audit-dry.mjs'],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(run.stdout);
 assert.equal(report.technicalStatus,'TECHNICAL_PASS');assert.equal(report.provenanceStatus,'UNVERIFIED');
 assert.equal(report.visualStatus,'VISUAL_REVIEW_PENDING');
});
