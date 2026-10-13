const finite=x=>typeof x==='number'&&Number.isFinite(x);
const vec=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function lerp(a,b,t){return a+(b-a)*t;}
function interpolated(track,time){
 const keys=track.keys;
 if(time<=keys[0].time)return structuredClone(keys[0].value);
 if(time>=keys.at(-1).time)return structuredClone(keys.at(-1).value);
 let lo=0,hi=keys.length-1;
 while(lo+1<hi){
  const mid=(lo+hi)>>1;
  if(keys[mid].time<=time)lo=mid;else hi=mid;
 }
 const first=keys[lo],second=keys[hi];
 let u=(time-first.time)/(second.time-first.time);
 if(track.interpolation==='smoothstep')u=u*u*(3-2*u);
 const a=first.value,b=second.value;
 return Array.isArray(a)?a.map((value,i)=>lerp(value,b[i],u)):lerp(a,b,u);
}
export function sampleAnimation(compiled,clipId,timeSeconds){
 const manifest=compiled?.manifest;
 const clip=manifest?.animations?.find(c=>c.id===clipId);
 if(!clip)throw new Error('unknown animation clip');
 if(!finite(timeSeconds)||timeSeconds<0||timeSeconds>clip.length)throw new Error('animation time outside clip');
 const t=timeSeconds===clip.length?0:timeSeconds;
 const parts=Object.fromEntries(manifest.parts.map(part=>[part.id,{position:[0,0],scale:[1,1],rotation:0,poseId:null}]));
 let lightEnergy=manifest.light?.energy??0;
 for(const track of clip.tracks){
  const value=interpolated(track,t);
  if(track.property==='light_energy')lightEnergy=value;
  else if(parts[track.part])parts[track.part][track.property]=value;
 }
 const seq=manifest.frameSequence;
 if(seq?.frames?.length){
  const index=Math.floor(t*seq.fps)%seq.frames.length;
  parts[seq.part].poseId=seq.frames[index];
 }
 return {clipId,timeSeconds,parts,lightEnergy};
}

export function auditLoop(compiled,clipId){
 const clip=compiled?.manifest?.animations?.find(c=>c.id===clipId);
 if(!clip)throw new Error('unknown clip');
 const errors=[];
 const cycles=2,fps=30,steps=Math.ceil(cycles*clip.length*fps);
 let maxSeamDelta=0,maxStepDelta=0;
 let previous=null;
 const observe=(from,to,label,isSeam=false)=>{
  for(const partId of Object.keys(to.parts)){
   const a=from.parts[partId],b=to.parts[partId];
   const deltaPos=vec(a.position,b.position);
   const deltaScale=Math.max(Math.abs(a.scale[0]-b.scale[0]),Math.abs(a.scale[1]-b.scale[1]));
   const deltaRot=Math.abs(a.rotation-b.rotation);
   if(!finite(deltaPos)||!finite(deltaScale)||!finite(deltaRot))errors.push('nonfinite sample');
   maxStepDelta=Math.max(maxStepDelta,deltaPos,deltaScale,deltaRot);
   if(isSeam){
    maxSeamDelta=Math.max(maxSeamDelta,deltaPos,deltaScale,deltaRot);
    if(deltaPos>0.5||deltaScale>0.01||deltaRot>0.01)errors.push('loop seam discontinuity in '+partId);
   }else if(deltaPos>4||deltaScale>0.05||deltaRot>0.04){
    errors.push('animation step exceeds limit for '+partId+' position/scale/rotation');
   }
  }
  const energyDelta=Math.abs(to.lightEnergy-from.lightEnergy);
  if(!finite(energyDelta)||energyDelta>(isSeam?0.02:0.15))errors.push((isSeam?'seam':'step')+' light energy discontinuity');
 };
 for(let i=0;i<=steps;i++){
  const raw=i/fps;
  const time=raw%clip.length;
  const frame=sampleAnimation(compiled,clipId,time);
  if(previous)observe(previous,frame,'step');
  previous=frame;
 }
 const before=sampleAnimation(compiled,clipId,Math.max(0,clip.length-0.0001));
 const after=sampleAnimation(compiled,clipId,0);
 observe(before,after,'seam',true);
 // Sample explicit endpoints independently, not just a modulo wrap.
 const end=sampleAnimation(compiled,clipId,clip.length);
 observe(end,after,'endpoint',true);
 return {ok:errors.length===0,errors,metrics:{samples:steps+1,cycles,maxSeamDelta,maxStepDelta}};
}
