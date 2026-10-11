import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderSvg} from '../core/render-svg.mjs';
import {selectPartDocument} from './compile.mjs';
import {sampleAnimation} from './animation.mjs';

const identity=[1,0,0,1,0,0];
const mult=([a,b,c,d,e,f],[g,h,i,j,k,l])=>[
 a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];
const move=(x,y)=>[1,0,0,1,x,y];
const turn=x=>[Math.cos(x),Math.sin(x),-Math.sin(x),Math.cos(x),0,0];
const scale=(x,y)=>[x,0,0,y,0,0];
const fmt=n=>Number(n.toFixed(10)).toString();
function matrixFor(part,state,byId,memo){
 if(memo.has(part.id))return memo.get(part.id);
 const parent=part.parent?matrixFor(byId.get(part.parent),state,byId,memo):identity;
 const animated=state.parts[part.id];
 const [px,py]=part.pivot;
 let local=move(px+animated.position[0],py+animated.position[1]);
 local=mult(local,turn(animated.rotation));
 local=mult(local,scale(...animated.scale));
 local=mult(local,move(-px,-py));
 const world=mult(parent,local);
 memo.set(part.id,world);
 return world;
}
function scopedFragment(svg,prefix){
 const open=svg.indexOf('<svg '),begin=svg.indexOf('>',open);
 const end=svg.lastIndexOf('</svg>');
 if(open<0||begin<0||end<begin)throw Error('invalid generated source SVG');
 let body=svg.slice(begin+1,end);
 // Only rename renderer-controlled ga-* references; original node IDs remain globally unique.
 body=body.replaceAll(/id="(ga-[a-z0-9-]+)"/g,(_m,id)=>'id="'+prefix+'_'+id+'"')
  .replaceAll(/url\(#(ga-[a-z0-9-]+)\)/g,(_m,id)=>'url(#'+prefix+'_'+id+')');
 return body;
}
function projectFrameSvg(compiled,state){
 const byId=new Map(compiled.parts.map(p=>[p.id,p])),memo=new Map();
 const sorted=[...compiled.parts].sort((a,b)=>a.zIndex-b.zIndex||a.id.localeCompare(b.id));
 const parts=[];
 for(const part of sorted){
  const pose=state.parts[part.id].poseId;
  const subset=selectPartDocument(compiled,part.id,pose);
  const svg=renderSvg(subset);
  const world=matrixFor(part,state,byId,memo);
  parts.push('<g transform="matrix('+world.map(fmt).join(' ')+')">');
  parts.push(scopedFragment(svg,part.id));
  parts.push('</g>');
 }
 const {width,height}=compiled.canvas;
 return ['<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">',
 ...parts,'</svg>',''].join('\n');
}
function systemRasterize(svg){
 return execFileSync('rsvg-convert',['--format=png'],{
  input:svg,stdio:['pipe','pipe','pipe'],maxBuffer:8388608,timeout:8000
 });
}
export async function renderCutoutPreview({compiled,clipId,timeSeconds,rasterizeSvg=systemRasterize}){
 if(!compiled||typeof rasterizeSvg!=='function')throw Error('invalid preview input');
 const frame=sampleAnimation(compiled,clipId,timeSeconds);
 const svg=projectFrameSvg(compiled,frame);
 if(Buffer.byteLength(svg,'utf8')>1048576)throw Error('SVG render budget exceeded');
 let png;
 try{png=await rasterizeSvg(svg)}catch(e){throw Error('RASTERIZATION_FAILED: '+(e?.message??e))}
 if(!Buffer.isBuffer(png)||png.length<33||png.length>8388608||
  !png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('invalid preview PNG budget/signature');
 const digest=createHash('sha256').update(png).digest('hex');
 return {png,frame,digest};
}
