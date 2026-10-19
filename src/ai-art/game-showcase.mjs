import {createHash} from 'node:crypto';
import {cp,mkdtemp,readFile,rm,stat,lstat,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pngjs from 'pngjs';

const {PNG}=pngjs;
const exec=promisify(execFile);
const HASH=b=>createHash('sha256').update(b).digest('hex');
const SRC=fileURLToPath(new URL('../../examples/spirit-lantern/generated/phase3-godot/',import.meta.url));
const TIMES=Object.freeze([0,0.375,0.875,1.375]);
const fail=s=>{throw Error('GAME_SHOWCASE_REJECTED: '+s)};
const only=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).every(k=>keys.includes(k));
let busy=false;

export function computeFrameMetrics(a,b,width,height){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
   a.length!==b.length||a.length!==width*height*4)fail('incompatible framebuffer pixels');
 let changedPixels=0,delta=0,luminanceDelta=0;
 for(let i=0;i<a.length;i+=4){
  let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);
  d+=Math.abs(a[i+3]-b[i+3]);
  if(d)changedPixels++;
  delta+=d;
  luminanceDelta+=Math.abs((a[i]+a[i+1]+a[i+2])-(b[i]+b[i+1]+b[i+2]))/3;
 }
 return Object.freeze({changedPixels,
  changedFraction:Number((changedPixels/(width*height)).toFixed(6)),
  meanChannelDelta:Number((delta/(width*height*4)).toFixed(5)),
  meanLuminanceDelta:Number((luminanceDelta/(width*height)).toFixed(5)),
  artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false});
}
async function checkTrustedTree(dir,depth=0,budget={count:0,bytes:0}){
 if(depth>8)fail('scene source nesting exceeded budget');
 const entries=await readdir(dir,{withFileTypes:true});
 for(const entry of entries){
  const full=join(dir,entry.name),st=await lstat(full);
  if(st.isSymbolicLink()||(!st.isDirectory()&&!st.isFile()))fail('unsafe scene source node');
  if(st.isDirectory())await checkTrustedTree(full,depth+1,budget);
  else{budget.count++;budget.bytes+=st.size;}
  if(budget.count>256||budget.bytes>8*1024*1024)fail('scene source budget exceeded');
 }
}
async function runEngine(binary,args,ms){
 let out;
 try{
  out=await exec('timeout',['--signal=TERM','--kill-after=2s',
   Math.ceil(ms/1000-3)+'s',...args],{env:{...process.env,LIBGL_ALWAYS_SOFTWARE:'1'},
   timeout:ms,maxBuffer:1024*1024,killSignal:'SIGKILL'});
 }catch(e){fail('isolated test engine command failed or reached timeout '+String(e.code??e.signal??'ENGINE_FAILED'))}
 if(/SCRIPT ERROR|Parse Error|ERROR:/.test(out.stdout+' '+out.stderr))
  fail('Godot reported a scene or script error');
 return out.stdout;
}
async function captureAll(){
 if(busy)fail('another trusted scene capture is already running');
 busy=true;let temp;
 try{
  await checkTrustedTree(SRC);
  temp=await mkdtemp(join(tmpdir(),'game-artist-trusted-showcase-'));
  await cp(SRC,temp,{recursive:true,force:false,errorOnExist:false,dereference:false});
  // Godot must import resource/atlas textures first; a raw launch cannot resolve them.
  const engine=process.env.GODOT_BIN??'godot';
  await runEngine(engine,[engine,'--headless','--path',temp,'--editor','--quit'],40000);
  const log=await runEngine(engine,['xvfb-run','-a','--server-args','-screen 0 1024x768x24',
    engine,'--audio-driver','Dummy','--rendering-driver','opengl3',
    '--path',temp,'--scene','res://showcase.tscn','--','--capture-showcase'],45000);
  if(!log.includes('GAME_ARTIST_R7_SHOWCASE_OK'))fail('scene did not attest actual framebuffer');
  const frames=[];
  for(let i=0;i<TIMES.length;i++){
   const file=join(temp,'r7-showcase-review','frame-'+String(i).padStart(2,'0')+'.png');
   const st=await lstat(file);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1000||st.size>2*1024*1024)
    fail('invalid captured scene image');
   const png=await readFile(file);
   let bmp;
   try{bmp=PNG.sync.read(png,{checkCRC:true})}catch{fail('scene screenshot PNG invalid')}
   if(bmp.width!==512||bmp.height!==512||bmp.data.length!==512*512*4)
    fail('scene screenshot must be genuine 512px framebuffer');
   frames.push({index:i,timeSeconds:TIMES[i],png,pixels:bmp.data,sha256:HASH(png)});
  }
  return frames;
 }finally{
  try{if(temp)await rm(temp,{recursive:true,force:true,maxRetries:2})}
  finally{busy=false}
 }
}
export async function captureTrustedGameShowcase(options={}){
 if(!only(options,['frame'])||!Number.isSafeInteger(options.frame)||options.frame<0||options.frame>=TIMES.length)
  fail('only fixed actual-game frame index 0-3 is accepted');
 const frames=await captureAll(),frame=frames[options.frame];
 return {source:'ACTUAL_GODOT_PLAYABLE_SHOWCASE',gameScene:'TRUSTED_REPO_PLAYABLE_SHOWCASE',
  animation:'idle',frameIndex:frame.index,timeSeconds:frame.timeSeconds,size:512,
  sha256:frame.sha256,png:frame.png,realGodot:true,artisticReview:'UNSCORED',
  rightsVerified:false,exportAllowed:false};
}
export async function auditTrustedAnimation(options={}){
 if(!only(options,[]))fail('animation audit accepts no user scene arguments');
 const frames=await captureAll();
 const transitions=frames.slice(1).map((f,i)=>({
  fromTime:frames[i].timeSeconds,toTime:f.timeSeconds,
  ...computeFrameMetrics(frames[i].pixels,f.pixels,512,512)
 }));
 return {kind:'TECHNICAL_ANIMATION_MOTION_AUDIT',gameScene:'TRUSTED_REPO_PLAYABLE_SHOWCASE',
  animation:'idle',frameCount:frames.length,size:512,
  frames:frames.map(f=>({index:f.index,timeSeconds:f.timeSeconds,sha256:f.sha256,bytes:f.png.length})),
  transitions,framerateVerified:false,styleConsistencyVerified:false,
  independentReviewerCount:0,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false};
}


/** Honest quality-review packet. Scores must come from actual external visual
 * observation or independent reviewer evidence, never numeric-pixel heuristics. */
export async function createArtReviewPacket(options={}){
 if(!only(options,[]))fail('review packet accepts no arbitrary code or scene');
 const audit=await auditTrustedAnimation({});
 return {
  kind:'ART_DIRECTION_REVIEW_PACKET_UNSCORED',
  scene:audit.gameScene,animation:audit.animation,
  frameHashes:audit.frames.map(f=>({timeSeconds:f.timeSeconds,sha256:f.sha256})),
  technicalTelemetry:audit.transitions,
  rubric:[
   {criterion:'64px and 128px icon readability',score:null,evidence:'Requires visual inspection of downscaled real frame'},
   {criterion:'Animation silhouette continuity and absence of foot/pose popping',score:null,evidence:'Inspect 0.0, 0.375, 0.875, 1.375 second frames'},
   {criterion:'Flame lighting and interaction with environment',score:null,evidence:'Compare actual Godot light-on/off or motion frames'},
   {criterion:'Atmospheric depth, foreground occlusion and composition',score:null,evidence:'Review actual game-world screenshots'},
   {criterion:'Distinctive aesthetic quality, palette coherence and anti-AI-slop',score:null,evidence:'Requires explicit artist/owner qualitative review'}
  ],
  technicalGate:'GODOT_CAPTURE_VERIFIED_ART_UNSCORED',
  humanReviewerCount:0,modelCritiqueObserved:false,artisticReview:'UNSCORED',
  rightsVerified:false,exportAllowed:false
 };
}
