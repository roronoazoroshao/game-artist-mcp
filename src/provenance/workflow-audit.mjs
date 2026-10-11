import {validateChallenge,validateExportEvidence} from './contracts.mjs';
import {auditEventChain} from './event-audit.mjs';

export function auditArtWorkflow({challenge,events,exports}={}){
 const reasons=[];
 const metrics={toolCalls:0,renderCount:0,correctionRounds:0,elapsedMs:0};
 let m,x;
 try{m=validateChallenge(challenge);x=validateExportEvidence(exports);}catch{reasons.push('challenge or export contract invalid');}
 const chain=auditEventChain({challenge,events});
 metrics.toolCalls=chain.toolCalls;metrics.renderCount=chain.renderCount;metrics.correctionRounds=chain.correctionRounds;
 if(!chain.ok)reasons.push(...chain.errors.map(e=>'event: '+e));
 if(!m||!x)return {status:'WORKFLOW_NO_GO',technicalStatus:'TECHNICAL_NO_GO',reasons,metrics};
 if(x.challengeDigest!==m.challengeDigest||x.sourceCommitSha!==m.projectSha||x.assetId!==m.assetId)reasons.push('export challenge/source/asset lineage mismatch');
 if(chain.toolCalls>m.toolCallBudget||chain.toolCalls>50)reasons.push('toolCallBudget exceeded');
 if(chain.correctionRounds>m.correctionBudget||chain.correctionRounds>5)reasons.push('correctionBudget exceeded');
 if(!Array.isArray(events)||events.length===0)reasons.push('missing workflow evidence');
 else {
  const t0=Date.parse(events[0].issuedAt),tLast=Date.parse(events[events.length-1].issuedAt);
  metrics.elapsedMs=tLast-t0;
  if(!Number.isFinite(t0)||!Number.isFinite(tLast)||metrics.elapsedMs<0||metrics.elapsedMs>m.timeBudgetSeconds*1000||metrics.elapsedMs>900000)reasons.push('timeBudgetSeconds exceeded');
  for(let i=1;i<events.length;i++)if(Date.parse(events[i].issuedAt)<Date.parse(events[i-1].issuedAt))reasons.push('nonmonotonic issuedAt');
 }
 const calls=[];
 const results=[];
 for(const e of events??[]){
  if(e.eventKind==='MODEL_TOOL_DECISION'){
   calls.push(e);
   if(e.sourceKind!=='AGENT_DECISION')reasons.push('scripted or unproven operation source');
  }
  if(e.eventKind==='TOOL_RESULT'){
   results.push(e);
   if(e.success!==true)reasons.push('failed tool attempt included');
   if(e.assetId!==undefined&&e.assetId!==m.assetId)reasons.push('asset reset / mismatch');
  }
 }
 const names=results.map(e=>e.toolName);
 const exactly=(tool)=>names.filter(n=>n===tool).length;
 const idx=(name,from=0)=>names.indexOf(name,from);
 if(!names.length||names[0]!=='style_profile_get'||names[1]!=='asset_create'||exactly('asset_create')!==1)reasons.push('style must precede single empty asset create');
 const created=results.find(e=>e.toolName==='asset_create');
 if(!created||created.assetRevision!==0)reasons.push('asset_create not revision zero');
 const firstEdit=idx('document_apply_ops'),firstPreview=idx('render_preview');
 const secondEdit=idx('document_apply_ops',firstEdit+1),secondPreview=idx('render_preview',firstPreview+1);
 if(firstEdit<2||firstPreview<=firstEdit||secondEdit<=firstPreview||secondPreview<=secondEdit)reasons.push('expected authored edit → preview → grounded correction → rerender');
 if(exactly('render_preview')!==2||exactly('document_apply_ops')!==2||exactly('export_asset')!==1)reasons.push('ambiguous revision lineage / extra selection attempts');
 const init=results[firstPreview],rev=results[secondPreview];
 if(!init||!rev||init.imageSha256!==x.initialMcpPngSha256||rev.imageSha256!==x.revisedMcpPngSha256||
   init.assetRevision!==x.initialRevision||rev.assetRevision!==x.finalRevision)reasons.push('rendered PNG / revision lineage mismatch');
 const critiques=(events??[]).filter(e=>e.eventKind==='MODEL_CRITIQUE');
 const deliveries=(events??[]).filter(e=>e.eventKind==='MODEL_IMAGE_DELIVERED');
 const edited=(events??[]).filter(e=>e.eventKind==='MODEL_TOOL_DECISION'&&e.toolName==='document_apply_ops');
 if(critiques.length!==1||deliveries.length<2||edited.length!==2||
   critiques[0]?.imageSha256!==x.initialMcpPngSha256||
   events.indexOf(critiques[0])<=events.findIndex(e=>e.eventKind==='MODEL_IMAGE_DELIVERED')||
   events.indexOf(critiques[0])>=events.indexOf(edited[1]))reasons.push('missing grounded critique between delivered image and targeted edit');
 for(const tool of ['validate_asset','style_validate','export_asset']){
  const r=results.find(e=>e.toolName===tool);
  if(!r||r.assetRevision!==x.finalRevision||idx(tool)<=secondPreview)reasons.push('missing final '+tool+' binding');
 }
 if(idx('export_asset')<idx('style_validate')||idx('style_validate')<idx('validate_asset'))reasons.push('invalid validation/export order');
 if(reasons.length)return {status:'WORKFLOW_NO_GO',technicalStatus:'TECHNICAL_NO_GO',reasons:[...new Set(reasons)],metrics};
 // The wire event sourceKind and narrative critique are not independently verified.
 return {status:'UNDETERMINED',technicalStatus:'TECHNICAL_PASS',reasons:['AGENT_PROVENANCE_PENDING','SEMANTIC_GROUNDING_UNVERIFIED'],metrics};
}
