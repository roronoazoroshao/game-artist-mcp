import {constants} from 'node:fs';
import {lstat,open,rename,rm} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {renderPaint} from './paint-workstation.mjs';

const MAX_BYTES=65536, SHA=/^[a-f0-9]{64}$/;
const fail=m=>{throw Error('VISION_SESSION_REJECTED: '+m)};
const own=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>names.includes(k));
const finiteString=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const checksum=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashBytes=b=>createHash('sha256').update(b).digest('hex');
const fields=s=>({
  assetId:s.assetId,version:s.version,phase:s.phase,iteration:s.iteration,maxIterations:s.maxIterations,
  brief:s.brief,size:s.size,environment:s.environment,paintRevision:s.paintRevision,
  observationSha256:s.observation?.sha256??null,lastCritique:s.decisions.at(-1)?.critique??null,
  decisionCount:s.decisions.length,observationCount:s.observations.length,
  sessionKind:'EXTERNAL_VISION_HOST_DECISION_LOOP',humanOrAiVisionNeeded:true,
  artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false
});

export class ArtistVisionSession {
  constructor({paint,observer}={}){
    if(!paint?.store?.withAssetWriteLock||typeof paint.applyLocked!=='function'||
       !observer||typeof observer.observe!=='function')fail('missing trusted painting/observation adapters');
    this.paint=paint;this.observer=observer;
  }
  file(assetId){return join(this.paint.store.assetDir(assetId),'vision-session.json')}
  async load(assetId){
    await this.paint.load(assetId); // validates all workspace parents
    const path=this.file(assetId);
    let handle;
    try{
      const st=await lstat(path);
      if(!st.isFile()||st.isSymbolicLink()||st.size<5||st.size>MAX_BYTES)fail('unsafe vision checkpoint file');
      handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
      const info=await handle.stat();
      if(!info.isFile()||info.size>MAX_BYTES)fail('unsafe checkpoint bytes');
      const bytes=await handle.readFile();
      if(bytes.length>MAX_BYTES)fail('oversized checkpoint');
      let value;
      try{value=JSON.parse(bytes.toString('utf8'))}catch{fail('malformed checkpoint')}
      if(value.schema!==1||value.assetId!==assetId||!Number.isSafeInteger(value.version)||
          !Number.isSafeInteger(value.paintRevision)||!Number.isSafeInteger(value.iteration)||
          !Number.isSafeInteger(value.maxIterations)||value.maxIterations<1||value.maxIterations>3||
          !['NEEDS_OBSERVATION','AWAITING_CRITIQUE','MUTATING','REVIEW_PENDING'].includes(value.phase)||
          !Array.isArray(value.observations)||!Array.isArray(value.decisions)||
          value.observations.length>4||value.decisions.length>4||value.iteration>value.maxIterations||
          value.artisticReview!=='UNSCORED'||value.rightsVerified!==false||value.exportAllowed!==false||
          !['twilight','moonlight'].includes(value.environment)||![64,128,512].includes(value.size)||
          !finiteString(value.brief,10,500)||!own(value,[
            'schema','assetId','version','phase','iteration','maxIterations','brief','size',
            'environment','paintRevision','observations','decisions','observation','pending',
            'artisticReview','rightsVerified','exportAllowed']))
        fail('invalid or falsified checkpoint');
      return value;
    }catch(e){if(e.code==='ELOOP')fail('symlink checkpoint');throw e}
    finally{if(handle)await handle.close()}
  }
  async save(assetId,value,{create=false}={}){
    const path=this.file(assetId),bytes=Buffer.from(JSON.stringify(value)+'\n');
    if(bytes.length>MAX_BYTES)fail('vision journal budget');
    if(create){
      let h;
      try{h=await open(path,'wx',0o600);await h.writeFile(bytes);await h.sync()}
      catch(e){if(e.code==='EEXIST')fail('session already exists; cannot replace history');throw e}
      finally{if(h)await h.close()}
      return;
    }
    const before=await lstat(path);
    if(!before.isFile()||before.isSymbolicLink())fail('checkpoint changed to unsafe path');
    const staging=path+'.'+randomBytes(12).toString('hex')+'.tmp';
    try{
      const h=await open(staging,'wx',0o600);
      try{await h.writeFile(bytes);await h.sync()}finally{await h.close()}
      await rename(staging,path);
    }finally{await rm(staging,{force:true})}
  }
  async begin(assetId,options={}){
    if(!own(options,['brief','size','environment','maxIterations'])||
       !finiteString(options.brief,10,500)||![64,128,512].includes(options.size)||
       !['twilight','moonlight'].includes(options.environment)||
       !Number.isSafeInteger(options.maxIterations)||options.maxIterations<1||options.maxIterations>3)
      fail('invalid limited session brief/settings');
    return this.paint.store.withAssetWriteLock(assetId,async()=>{
      const p=await this.paint.load(assetId);
      const state={schema:1,assetId,version:0,phase:'NEEDS_OBSERVATION',iteration:0,
        maxIterations:options.maxIterations,brief:options.brief,size:options.size,
        environment:options.environment,paintRevision:p.revision,
        observations:[],decisions:[],observation:null,pending:null,
        artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false};
      await this.save(assetId,state,{create:true});
      return fields(state);
    });
  }
  async reconcileLocked(assetId){
    let state=await this.load(assetId);
    if(state.phase!=='MUTATING')return state;
    const intent=state.pending;
    if(!own(intent,['decision','fromRevision','targetRevision','operations','critique','observationSha256'])||
       !['REVISE','REVERT'].includes(intent.decision)||
       !Number.isSafeInteger(intent.fromRevision))fail('corrupt mutation intent');
    const p=await this.paint.load(assetId);
    if(p.revision===intent.fromRevision){ // No paint commit: do not fabricate an applied edit.
      state={...state,phase:'AWAITING_CRITIQUE',pending:null};
    }else if(p.revision===intent.fromRevision+1){
      const applied=p.history.at(-1)?.operations;
      const expected=intent.decision==='REVISE'?intent.operations:[{type:'restore',targetRevision:intent.targetRevision}];
      if(checksum(applied)!==checksum(expected))fail('unreconciled foreign painting mutation');
      state=this.finalize(state,intent,p.revision);
    }else fail('unreconciled revision drift');
    await this.save(assetId,state);return state;
  }
  finalize(state,intent,nextRevision){
    const done=intent.decision==='REVERT';
    return {...state,version:state.version+1,
      iteration:state.iteration+(intent.decision==='REVISE'?1:0),
      paintRevision:nextRevision,phase:done?'REVIEW_PENDING':'NEEDS_OBSERVATION',
      observation:null,pending:null,
      decisions:[...state.decisions,{decision:intent.decision,critique:intent.critique,
        fromRevision:intent.fromRevision,toRevision:nextRevision,observationSha256:intent.observationSha256}]};
  }
  async status(assetId){
    return this.paint.store.withAssetWriteLock(assetId,async()=>{
      const state=await this.reconcileLocked(assetId);
      const p=await this.paint.load(assetId);
      if(p.revision!==state.paintRevision)fail('painting has been modified outside session');
      return fields(state);
    });
  }
  async observe(assetId,{expectedVersion}={}){
    const state=await this.load(assetId);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==state.version||
       state.phase!=='NEEDS_OBSERVATION')fail('observation version/state conflict');
    const p=await this.paint.load(assetId);
    if(p.revision!==state.paintRevision)fail('painting revision drift');
    const result=await this.observer.observe(assetId,{
      revision:state.paintRevision,size:state.size,environment:state.environment
    });
    if(result.engine!=='REAL_GODOT_FRAMEBUFFER'||result.scene!=='DETERMINISTIC_ART_STAGING_FIXTURE'||
       !SHA.test(result.sha256??'')||!SHA.test(result.sourcePaintSha256??'')||
       result.sourcePaintSha256!==renderPaint(p).sha256||
       result.artisticReview!=='UNSCORED'||result.exportAllowed!==false||
       result.rightsVerified!==false||!Buffer.isBuffer(result.png)||result.png.length<80||
       result.png.length>2*1024*1024||hashBytes(result.png)!==result.sha256)
      fail('uncertified or mismatched Godot capture evidence');
    const next=await this.paint.store.withAssetWriteLock(assetId,async()=>{
      const current=await this.reconcileLocked(assetId);
      const actual=await this.paint.load(assetId);
      if(current.version!==state.version||current.phase!=='NEEDS_OBSERVATION'||
         actual.revision!==state.paintRevision)fail('capture became stale');
      const x={...current,version:current.version+1,phase:'AWAITING_CRITIQUE',
        observation:{sha256:result.sha256,sourcePaintSha256:result.sourcePaintSha256,
         revision:result.revision,environment:result.environment,size:result.size},
        observations:[...current.observations,{sha256:result.sha256,revision:result.revision}]};
      await this.save(assetId,x);return fields(x);
    });
    return {...next,png:result.png,observationSha256:result.sha256,sourcePaintSha256:result.sourcePaintSha256};
  }
  async decide(assetId,request={}){
    if(!own(request,['expectedVersion','observationSha256','decision','critique','operations'])||
       !Number.isSafeInteger(request.expectedVersion)||!SHA.test(request.observationSha256??'')||
       !['REVISE','REVERT','FINISH'].includes(request.decision)||
       !finiteString(request.critique,10,600)||request.operations!==undefined&&
       (request.decision!=='REVISE'||!Array.isArray(request.operations)))
      fail('invalid external vision decision');
    return this.paint.store.withAssetWriteLock(assetId,async()=>{
      const state=await this.reconcileLocked(assetId),p=await this.paint.load(assetId);
      if(state.version!==request.expectedVersion||state.phase!=='AWAITING_CRITIQUE'||
         p.revision!==state.paintRevision||
         state.observation?.sha256!==request.observationSha256||
         state.observation?.revision!==state.paintRevision)
        fail('decision lacks current authenticated image binding');
      if(request.decision==='FINISH'){
        if(request.operations!==undefined)fail('finish must not carry painting actions');
        const next={...state,version:state.version+1,phase:'REVIEW_PENDING',
          observation:null,decisions:[...state.decisions,{decision:'FINISH',
          critique:request.critique,fromRevision:p.revision,toRevision:p.revision,
          observationSha256:request.observationSha256}]};
        await this.save(assetId,next);return fields(next);
      }
      if(request.decision==='REVISE'&&(state.iteration>=state.maxIterations||
         !Array.isArray(request.operations)||request.operations.length<1||
         request.operations.length>12))fail('bounded revision iteration budget');
      if(request.decision==='REVERT'&&(request.operations!==undefined||
         p.revision<=0||state.iteration<1))fail('cannot revert unmodified session');
      const intent={decision:request.decision,fromRevision:p.revision,
        targetRevision:request.decision==='REVERT'?state.paintRevision-state.iteration:null,
        operations:request.decision==='REVISE'?request.operations:null,
        critique:request.critique,observationSha256:request.observationSha256};
      const prepared={...state,phase:'MUTATING',pending:intent};
      await this.save(assetId,prepared);
      try{
        if(intent.decision==='REVISE')
          await this.paint.applyLocked(assetId,{expectedRevision:p.revision,operations:intent.operations});
        else
          await this.paint.restoreLocked(assetId,{expectedRevision:p.revision,targetRevision:intent.targetRevision});
      }catch(e){
        // Recovery must run behind the same lock. No fake success on failed edit.
        const rollback={...state,phase:'AWAITING_CRITIQUE',pending:null};
        await this.save(assetId,rollback);
        if(e.message?.startsWith('PAINT_REJECTED'))throw e;
        fail('painting change rejected without advancing session: '+String(e.code??'INVALID_EDIT'));
      }
      const next=this.finalize(state,intent,p.revision+1);
      await this.save(assetId,next);
      return fields(next);
    });
  }
}
