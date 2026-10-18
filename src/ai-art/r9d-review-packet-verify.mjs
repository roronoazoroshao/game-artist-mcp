import {readFile,readdir,lstat} from 'node:fs/promises';
import {join,resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const HEAD=/^[a-f0-9]{40}$/;
const SHA=/^[a-f0-9]{64}$/;
const ORA='f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361';
const fail=(why)=>{throw Error('R9D_REVIEW_PACKET_REJECTED: '+why);};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const digest=b=>createHash('sha256').update(b).digest('hex');
const PNG_MAGIC=Buffer.from('89504e470d0a1a0a','hex');
/** Parse the fixed 33-byte PNG signature/IHDR *before* invoking the inflater. */
export function preflightR9dPngHeader(bytes,size){
 if(!Buffer.isBuffer(bytes)||bytes.length<33||
    ![64,128,512].includes(size)||
    !bytes.subarray(0,8).equals(PNG_MAGIC)||
    bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||
    bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size||
    bytes[24]!==8||bytes[25]!==6||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)
  fail('PNG IHDR dimension/format violates fixed framebuffer contract');
 return true;
}
async function readWithinBudget(path,maxBytes){
 const stat=await lstat(path);
 if(!stat.isFile()||stat.size<1||stat.size>maxBytes)
  fail('file exceeds static byte budget');
 return readFile(path);
}
const PUBLIC_NAMES=['README.md','viewer.html','scorecard-template.json','manifest.json'];
const KEYS=['kind','sourceHead','sourceRun','sourceArtifactId','sourceOraSha256','sealCommitmentSha256','sampling','physicalDisplayTimingMeasured','exportAllowed','rightsVerified','humanReviewStatus','framesPerVariant60Hz','static512TimesMs','files'];
function expectedImageSizes(m){
 const expected=new Map();
 for(const variant of ['A','B']){
  for(const size of [64,128])for(let tick=0;tick<120;tick++)
   expected.set(`variants/${variant}/${size}/frame-${String(tick).padStart(3,'0')}.png`,size);
  for(const time of m.static512TimesMs)
   expected.set(`variants/${variant}/512-static/${String(time).padStart(4,'0')}.png`,512);
 }
 return expected;
}
/** Source-integrity validation, not a review verdict or third-party license check. */
export function validateR9dReviewManifest(m,{expectedSourceHead}={}){
 if(!obj(m)||Object.keys(m).length!==KEYS.length||Object.keys(m).some(k=>!KEYS.includes(k))||KEYS.some(k=>!Object.hasOwn(m,k)))fail('unknown or missing manifest fields');
 if(!HEAD.test(expectedSourceHead??'')||m.sourceHead!==expectedSourceHead)fail('source HEAD not pinned');
 if(m.kind!=='R10_BLIND_REVIEW_UNSCORED'||m.sourceOraSha256!==ORA||
  !SHA.test(m.sealCommitmentSha256??'')||
  !Number.isSafeInteger(m.sourceRun)||m.sourceRun<1||
  !Number.isSafeInteger(m.sourceArtifactId)||m.sourceArtifactId<1)fail('untrusted source or mapping commitment');
 if(m.sampling!=='GODOT_DETERMINISTIC_120HZ_SEEK_EVEN_TICKS_FOR_60FPS_VIEWER'||
  m.physicalDisplayTimingMeasured!==false||m.framesPerVariant60Hz!==120)fail('false physical display timing claim');
 if(m.exportAllowed!==false||m.rightsVerified!==false||m.humanReviewStatus!=='PENDING')
  fail('false release or human art approval claim');
 if(!Array.isArray(m.static512TimesMs)||m.static512TimesMs.length!==15||
    m.static512TimesMs.some((v,i)=>!Number.isSafeInteger(v)||v<0||v>1999||(i>0&&v<=m.static512TimesMs[i-1])))
  fail('untrusted static frame timestamps');
 if(!obj(m.files))fail('missing source file digests');
 const expected=expectedImageSizes(m);
 const actual=Object.keys(m.files);
 if(expected.size!==510||actual.length!==510||actual.some(key=>!expected.has(key)||!SHA.test(m.files[key]??'')))
  fail('missing, extra, traversal or incorrect source digests');
 return Object.freeze({status:'R9D_BLIND_PACKET_MANIFEST_VALIDATED',imageCount:510,
  sourceHead:m.sourceHead,sourceOraSha256:ORA,sealCommitmentSha256:m.sealCommitmentSha256,
  candidateIdentity:'SEALED_A_B_MAPPING',sampling:m.sampling,
  artisticReview:'REVIEW_PENDING',commercialRightsCleared:false,exportAllowed:false});
}
/** Re-checks every real PNG byte, PNG CRC/geometry and accidental private-file leaks.
 * Does NOT attest Adobe/provider origin or qualify independent humans.
 * Never use review packet hashes as commercial-rights evidence.
 */
export async function verifyR9dReviewPacket({root,expectedSourceHead}={}){
 if(typeof root!=='string'||!root.startsWith('/')||root.length>4096)fail('root must be absolute private directory');
 const base=resolve(root);
 const found=[];
 async function walk(dir){
  if(found.length>700)fail('too many files');
  for(const entry of await readdir(dir,{withFileTypes:true})){
   if(entry.isSymbolicLink())fail('symlink in public reviewer kit');
   const path=join(dir,entry.name);
   if(entry.isDirectory()){await walk(path);continue;}
   if(!entry.isFile())fail('untrusted special file');
   const name=relative(base,path).split(sep).join('/');
   found.push(name);
   if(found.length>700)fail('too many files');
  }
 }
 try{if(!(await lstat(base)).isDirectory())fail('not a directory');await walk(base);}
 catch(e){if(e.message?.startsWith('R9D_REVIEW_PACKET_REJECTED:'))throw e;fail('unreadable kit root');}
 const declared=new Set(PUBLIC_NAMES);
 const manifestPath=join(base,'manifest.json');
 if(!found.includes('manifest.json'))fail('missing manifest');
 let m;
 try{
  const bytes=await readWithinBudget(manifestPath,200000);
  m=JSON.parse(bytes.toString('utf8'));
 }catch(e){if(e.message?.startsWith('R9D_REVIEW_PACKET_REJECTED:'))throw e;fail('invalid manifest');}
 const summary=validateR9dReviewManifest(m,{expectedSourceHead});
 const expected=expectedImageSizes(m);
 for(const key of expected.keys())declared.add(key);
 if(found.length!==declared.size||found.some(name=>!declared.has(name)))
  fail('unexpected file (including possible sealed mapping)');
 let total=0;
 for(const [name,size] of expected){
  const bytes=await readWithinBudget(join(base,...name.split('/')),4194304);
  total+=bytes.length;
  if(bytes.length<100||bytes.length>4194304||total>67108864)
   fail('source bytes outside bounded budget');
  if(digest(bytes)!==m.files[name])fail('source PNG SHA mismatch: '+name);
  preflightR9dPngHeader(bytes,size);
  let png;
  try{png=PNG.sync.read(bytes,{checkCRC:true});}
  catch{fail('invalid real PNG/CRC: '+name);}
  if(png.width!==size||png.height!==size||png.data.length!==size*size*4)
   fail('PNG size mismatch: '+name);
 }
 const template=JSON.parse((await readWithinBudget(join(base,'scorecard-template.json'),65536)).toString('utf8'));
 if(template?.reviewerDeclaration!==null||
    template?.packetZipSha256!==null||
    template?.preferredVariant!==null||
    Object.values(template?.scores_1to5??{}).some(v=>v!==null))
  fail('reviewer template contains scores, reviewer signature or fabricated verdict');
 const html=(await readWithinBudget(join(base,'viewer.html'),500000)).toString('utf8');
 const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
 if(!csp||!csp.includes("default-src 'none'")||
    !csp.includes("connect-src 'none'")||!csp.includes("form-action 'none'")||
    !csp.includes("base-uri 'none'")||!csp.includes("object-src 'none'")||
    csp.includes("'unsafe-inline'")||csp.includes("'unsafe-eval'"))
  fail('offline viewer security policy missing or insufficient');
 const styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)];
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
 if(styles.length!==1||scripts.length!==1||
    (html.match(/<style\b/gi)||[]).length!==1||
    (html.match(/<script\b/gi)||[]).length!==1)
  fail('unexpected viewer script/style payload');
 const sri=content=>'sha256-'+createHash('sha256').update(content).digest('base64');
 if(!csp.includes("style-src '"+sri(styles[0][1])+"'")||
    !csp.includes("script-src '"+sri(scripts[0][1])+"'"))
  fail('reviewer script/style hash not pinned by CSP');
 if(html.length>500000||html.includes('https://')||html.includes('http://')||/(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|eval)\s*\(/i.test(html))
  fail('reviewer html includes obvious external communication or dynamic evaluation');
 return Object.freeze({...summary,status:'R9D_BLIND_PACKET_510_PNG_INTEGRITY_PASS',
  verifiedPngCount:510,totalPngBytes:total,
  independentHumanReviewerCount:0,providerModelVersion:'UNVERIFIED',
  commercialRightsCleared:false,exportAllowed:false});
}
