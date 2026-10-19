import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pngjs from 'pngjs';
import {renderPaint} from './paint-workstation.mjs';

const {PNG}=pngjs;
const exec=promisify(execFile);
const fail=reason=>{throw Error('GODOT_OBSERVE_REJECTED: '+reason);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const CAPTURE_SCRIPT=fileURLToPath(new URL('../../scripts/artist-godot-observer-capture.gd',import.meta.url));
const VALID_SIZES=new Set([64,128,512]);
const VALID_ENVS=new Set(['twilight','moonlight']);
const keys=(o,allowed)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).every(k=>allowed.includes(k));
const validate=(opts,allowed)=>{
 if(!keys(opts,allowed)||!VALID_SIZES.has(opts.size)||!VALID_ENVS.has(opts.environment))
  fail('invalid controlled scene options');
};
const project=size=>[
 'config_version=5','',
 '[application]','run/main_scene="res://main.tscn"','',
 '[display]',
 'window/size/viewport_width='+size,
 'window/size/viewport_height='+size,
 'window/size/window_width_override='+size,
 'window/size/window_height_override='+size,''
].join('\n');
const scene=()=>[
 '[gd_scene load_steps=2 format=3]','',
 '[ext_resource type="Script" path="res://capture.gd" id="1"]','',
 '[node name="GameArtistObserver" type="Node2D"]',
 'script = ExtResource("1")',''
].join('\n');
const isAllowedRevision=(n,p)=>Number.isSafeInteger(n)&&n>=0&&n<=p.revision;
let activeCapture=false;

async function launchGodotFrame(projectState,{revision,size,environment}, {binary}){
 if(activeCapture)fail('another real scene capture is already running');
 activeCapture=true;
 let dir;
 try{
  dir=await mkdtemp(join(tmpdir(),'game-artist-godot-observe-'));
  const art=renderPaint(projectState,{revision});
  await writeFile(join(dir,'art.png'),art.png,{flag:'wx',mode:0o600});
  await writeFile(join(dir,'project.godot'),project(size),{flag:'wx',mode:0o600});
  await writeFile(join(dir,'main.tscn'),scene(),{flag:'wx',mode:0o600});
  await writeFile(join(dir,'capture.gd'),await readFile(CAPTURE_SCRIPT),{flag:'wx',mode:0o600});
  const engine=binary??process.env.GODOT_BIN??'godot';
  // Never accept a filename/engine command from the MCP request. All argv are
  // independently constructed here, all GDScript is trusted static repo code.
  const args=['--signal=TERM','--kill-after=2s','25s','xvfb-run',
   '-a','--server-args','-screen 0 1024x768x24',engine,
   '--audio-driver','Dummy','--rendering-driver','opengl3',
   '--path',dir,'--scene','res://main.tscn'];
  if(environment==='moonlight')args.push('--','--moonlight');
  let result;
  try{
   result=await exec('timeout',args,{env:{...process.env,LIBGL_ALWAYS_SOFTWARE:'1'},
     timeout:30000,maxBuffer:1024*1024,killSignal:'SIGKILL'});
  }catch(e){fail('Godot/Xvfb failed, timed out, or was not installed: '+String(e.code??e.signal??'EXEC_FAILED'))}
  if(!result.stdout.includes('ARTIST_GODOT_SCENE_REAL_FRAMEBUFFER_OK')||
     /SCRIPT ERROR|Parse Error|ERROR:/.test(result.stdout+'\n'+result.stderr))
   fail('engine did not attest a successful capture');
  const output=join(dir,'scene-shot.png');
  const st=await lstat(output);
  if(!st.isFile()||st.isSymbolicLink()||st.size<80||st.size>2*1024*1024)
   fail('missing or oversized screenshot file');
  const png=await readFile(output);
  let bitmap;
  try{bitmap=PNG.sync.read(png,{checkCRC:true})}
  catch{fail('malformed engine PNG')}
  if(bitmap.width!==size||bitmap.height!==size||bitmap.data.length!==size*size*4)
   fail('engine image geometry mismatch');
  return Object.freeze({png,sha256:hash(png),revision,size,environment,sourcePaintSha256:art.sha256,
    engine:'REAL_GODOT_FRAMEBUFFER',scene:'DETERMINISTIC_ART_STAGING_FIXTURE',
    displayFpsMeasured:false,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false});
 }finally{
  try{if(dir)await rm(dir,{recursive:true,force:true,maxRetries:2})}finally{activeCapture=false}
 }
}

export function measureSceneDifference(a,b){
 if(a.engine!=='REAL_GODOT_FRAMEBUFFER'||b.engine!==a.engine||a.size!==b.size||
   a.environment!==b.environment)fail('scene diff must compare same environment and geometry');
 let aa,bb;
 try{aa=PNG.sync.read(a.png,{checkCRC:true});bb=PNG.sync.read(b.png,{checkCRC:true});}
 catch{fail('invalid capture image')}
 let changedPixels=0,sum=0;
 for(let i=0;i<aa.data.length;i+=4){
  let delta=0;
  for(let c=0;c<4;c++)delta+=Math.abs(aa.data[i+c]-bb.data[i+c]);
  if(delta!==0)changedPixels++;
  sum+=delta;
 }
 return {source:'GODOT_REAL_FRAMEBUFFER',environment:a.environment,size:a.size,
  baselineRevision:a.revision,candidateRevision:b.revision,
  baselineSha256:a.sha256,candidateSha256:b.sha256,
  changedPixels,meanChannelDelta:Math.round(sum/aa.data.length*1e4)/1e4,
  monitorFpsMeasured:false,artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false};
}
export class GodotPaintObserver{
 constructor({paint,binary}={}){if(!paint||typeof paint.load!=='function')fail('missing paint source');this.paint=paint;this.binary=binary;}
 async observe(assetId,options={}){
  validate(options,['revision','size','environment']);
  const p=await this.paint.load(assetId);
  if(!isAllowedRevision(options.revision,p))fail('unknown historical revision');
  return launchGodotFrame(p,options,{binary:this.binary});
 }
 async compare(assetId,options={}){
  validate(options,['baselineRevision','candidateRevision','size','environment']);
  const p=await this.paint.load(assetId);
  if(!isAllowedRevision(options.baselineRevision,p)||!isAllowedRevision(options.candidateRevision,p))
   fail('unknown historical revision');
  const left=await launchGodotFrame(p,{revision:options.baselineRevision,size:options.size,environment:options.environment},{binary:this.binary});
  const right=await launchGodotFrame(p,{revision:options.candidateRevision,size:options.size,environment:options.environment},{binary:this.binary});
  return measureSceneDifference(left,right);
 }
}
