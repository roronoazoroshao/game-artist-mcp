import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const SHA=/^[a-f0-9]{40}$/;
const hash=data=>createHash('sha256').update(data).digest('hex');
const frameName=index=>'frame-'+String(index).padStart(2,'0')+'.png';
const SAMPLE_TIMES=[0,0.375,0.875,1.375];
const SCALES=[512,128,64];
function checkedSha(value,name){
 if(!SHA.test(value??''))throw new Error(name+' requires exact 40-character Git SHA');
 return value;
}
function raster(bytes,context){
 const out=PNG.sync.read(bytes,{checkCRC:true});
 if(out.width!==512||out.height!==512)throw new Error(context+': expected real 512x512 Godot framebuffer');
 return out;
}
function resized(source,size){
 const factor=512/size,buffer=Buffer.alloc(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sums=[0,0,0,0];
  for(let iy=0;iy<factor;iy++)for(let ix=0;ix<factor;ix++){
   const k=((y*factor+iy)*512+(x*factor+ix))*4;
   for(let c=0;c<4;c++)sums[c]+=source.data[k+c];
  }
  const out=(y*size+x)*4;
  for(let c=0;c<4;c++)buffer[out+c]=Math.round(sums[c]/(factor*factor));
 }
 return buffer;
}
async function contactSheet(pairs,size,out){
 const sheet=new PNG({width:size*8,height:size,colorType:6});
 sheet.data.fill(0);
 for(let frame=0;frame<4;frame++){
  for(let variant=0;variant<2;variant++){
   const rgba=resized(pairs[frame][variant],size),ox=(frame*2+variant)*size;
   for(let y=0;y<size;y++){
    const from=y*size*4,to=(y*sheet.width+ox)*4;
    rgba.copy(sheet.data,to,from,from+size*4);
   }
  }
 }
 await writeFile(join(out,'contact-'+size+'.png'),PNG.sync.write(sheet));
}
export async function buildR8ReviewPacket({baselineDir,candidateDir,baselineSha,candidateSha,output}){
 checkedSha(baselineSha,'baselineSha');checkedSha(candidateSha,'candidateSha');
 if(baselineSha===candidateSha)throw new Error('baseline and candidate must have distinct source SHA');
 if(!baselineDir||!candidateDir||!output)throw new Error('all directories are required');
 const base=resolve(baselineDir),cand=resolve(candidateDir),out=resolve(output);
 if(base===cand||out===base||out===cand)throw new Error('baseline, candidate and output directories must be distinct');
 const pairs=[],frames=[];
 let meaningfulDifference=false;
 for(let i=0;i<4;i++){
  const [a,b]=await Promise.all([
   readFile(join(base,frameName(i))),
   readFile(join(cand,frameName(i)))
  ]);
  if(!a.equals(b))meaningfulDifference=true;
  const pair=[raster(a,'baseline '+i),raster(b,'candidate '+i)];
  pairs.push(pair);
  frames.push({index:i,timeSeconds:SAMPLE_TIMES[i],baselineSha256:hash(a),candidateSha256:hash(b)});
 }
 if(!meaningfulDifference)throw new Error('identical A/B image bytes cannot prove improvement');
 await mkdir(out,{recursive:true,mode:0o700});
 for(const size of SCALES)await contactSheet(pairs,size,out);
 const report={
  version:1,reviewStatus:'UNSCORED',baselineSha,candidateSha,
  baselineFrames:'Godot 4 real framebuffer 512x512',candidateFrames:'Godot 4 real framebuffer 512x512',
  outputDimensions:[512,128,64],
  downsample:'integer box-average from original 512px framebuffer (not camera zoom)',
  layout:'four times left-to-right; baseline immediately left of candidate at each time',
  frames,rubric:['original silhouette','64px readability','metal/parchment/thread materials','spatial light response','isometric scene coherence','flame motion','restraint and visual accessibility'],
  caveat:'Artifact provenance must be verified independently against GitHub Actions exact source runs; no scored ART_GO from CI'
 };
 await writeFile(join(out,'review.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
 return report;
}
function parseArgs(args){
 const kv={};
 for(let i=0;i<args.length;i+=2){
  const k=args[i],v=args[i+1];
  if(!k?.startsWith('--')||!v||Object.hasOwn(kv,k))throw new Error('invalid CLI arguments');
  kv[k]=v;
 }
 const required=['--baseline-dir','--candidate-dir','--baseline-sha','--candidate-sha','--output'];
 if(Object.keys(kv).length!==required.length||required.some(k=>!kv[k]))throw new Error('required baseline/candidate dirs, SHAs and output');
 return {baselineDir:kv['--baseline-dir'],candidateDir:kv['--candidate-dir'],baselineSha:kv['--baseline-sha'],candidateSha:kv['--candidate-sha'],output:kv['--output']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 buildR8ReviewPacket(parseArgs(process.argv.slice(2))).then(x=>{
  console.log(JSON.stringify({ok:true,frames:x.frames.length,reviewStatus:x.reviewStatus,baselineSha:x.baselineSha,candidateSha:x.candidateSha}));
 }).catch(e=>{console.error('R8_REVIEW_PACKET_REJECTED: '+String(e.message));process.exitCode=1;});
}
