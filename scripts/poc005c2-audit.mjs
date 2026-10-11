#!/usr/bin/env node
import {realpath,lstat,mkdir} from 'node:fs/promises';
import {dirname,basename,resolve,relative,sep} from 'node:path';
import {readBoundedFile,writeAtomicFile} from '../src/evaluation/safe-io.mjs';
import {parseEvaluationJson} from '../src/evaluation/contracts.mjs';
import {validateChallenge,validateInvocationEvent,validateExportEvidence} from '../src/provenance/contracts.mjs';
import {validateTrustPolicy} from '../src/provenance/trust-policy.mjs';
import {assessHostCapabilities} from '../src/provenance/host-capabilities.mjs';
import {auditArtWorkflow} from '../src/provenance/workflow-audit.mjs';
import {buildProvenanceReport,redactProvenanceReport} from '../src/provenance/report.mjs';
const usage='Usage: node scripts/poc005c2-audit.mjs --session <PRIVATE_SESSION_DIR> --policy <VERIFIER_OWNED_POLICY_JSON> --public-out <PRIVATE_REPORT_OUTPUT>\nOnly offline verification; no host calls, no provider signing or inference.\n';
if(process.argv.includes('--help')){process.stdout.write(usage);process.exit(0);}
async function run(){
 const a=process.argv.slice(2),args={};
 for(let i=0;i<a.length;i+=2){if(!['--session','--policy','--public-out'].includes(a[i])||!a[i+1]||args[a[i]])throw Error('invalid arguments');args[a[i]]=a[i+1];}
 if(Object.keys(args).length!==3)throw Error('missing --session, --policy or --public-out');
 const repoRoot=await realpath(new URL('../',import.meta.url).pathname);
 const inside=(root,p)=>p===root||p.startsWith(root+sep);
 const sessionRoot=await realpath(args['--session']);
 const policyPath=resolve(args['--policy']);const outputPath=resolve(args['--public-out']);
 const outputParent=await realpath(dirname(outputPath));
 if(inside(repoRoot,sessionRoot)||inside(repoRoot,outputParent)||inside(sessionRoot,outputParent))throw Error('evidence/output must be outside checkout and session root');
 const policyParent=await realpath(dirname(policyPath));
 const readJson=async(root,file)=>parseEvaluationJson((await readBoundedFile({root,relativePath:file,maxBytes:262144})).toString('utf8'));
 const challenge=validateChallenge(await readJson(sessionRoot,'challenge.json'));
 const events=await readJson(sessionRoot,'events.json');
 if(!Array.isArray(events)||events.length>400)throw Error('event count budget exceeded');
 for(const e of events)validateInvocationEvent(e);
 const exports=validateExportEvidence(await readJson(sessionRoot,'exports.json'));
 // Trust roots cannot be supplied by the model's session directory.
 if(inside(sessionRoot,policyParent)||inside(repoRoot,policyParent))throw Error('policy custody not independent');
 validateTrustPolicy(await readJson(policyParent,basename(policyPath)));
 const capabilities=assessHostCapabilities({documentedMechanisms:[],availableTools:[]});
 const workflow=auditArtWorkflow({challenge,events,exports});
 const privateReport=buildProvenanceReport({challenge,capabilities,attestations:[],events,workflow});
 const publicReport=redactProvenanceReport(privateReport);
 await writeAtomicFile({root:outputParent,relativePath:basename(outputPath),content:JSON.stringify(publicReport,null,2)+'\n'});
 process.stdout.write(JSON.stringify(publicReport)+'\n');
}
run().catch(()=>{process.stderr.write('Offline provenance verification BLOCKED: invalid or untrusted evidence (details redacted).\n');process.exitCode=2;});
