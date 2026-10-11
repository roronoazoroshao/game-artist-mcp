#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {challengeFixture,exportFixture,buildSyntheticWorkflow} from '../test/fixtures/provenance-fixtures.mjs';
import {auditArtWorkflow} from '../src/provenance/workflow-audit.mjs';
import {assessHostCapabilities} from '../src/provenance/host-capabilities.mjs';
import {buildProvenanceReport,redactProvenanceReport} from '../src/provenance/report.mjs';
const events=buildSyntheticWorkflow();
const workflow=auditArtWorkflow({challenge:challengeFixture,events,exports:exportFixture});
if(workflow.technicalStatus!=='TECHNICAL_PASS'||workflow.status!=='UNDETERMINED')throw Error('structural synthetic rehearsal failed');
const report=redactProvenanceReport(buildProvenanceReport({challenge:challengeFixture,capabilities:assessHostCapabilities(),attestations:[],events,workflow}));
if(report.provenanceStatus!=='UNVERIFIED'||report.visualStatus!=='VISUAL_REVIEW_PENDING')throw Error('synthetic evidence incorrectly upgraded');
const path=resolve('benchmarks/poc005c2/generated');await mkdir(path,{recursive:true});
await writeFile(resolve(path,'redacted-synthetic-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
process.stdout.write(JSON.stringify(report)+'\n');
