import {verifyAtlas} from '../cutout/atlas.mjs';

const fail=why=>{throw Error('R9D_CROSSFADE_REJECTED: '+why)};
const POSES=['flame_a','flame_b','flame_c','flame_d'];
const AUTHORED=[
 'flame_a','flame_b','flame_c','flame_d','flame_b','flame_c','flame_d','flame_a',
 'flame_c','flame_d','flame_a','flame_b','flame_d','flame_a','flame_b','flame_c'
];
const PHASE=0.125,FADE=0.055,HOLD=PHASE-FADE;
const OVERLAP_START=0.38,OVERLAP_END=0.62;
const clamp01=x=>Math.max(0,Math.min(1,x));
const fadeWeight=progress=>{const x=clamp01((progress-OVERLAP_START)/(OVERLAP_END-OVERLAP_START));return x*x*(3-2*x)};
const N=16;
const round=x=>Math.round(x*1000000)/1000000;
const v2=xy=>'Vector2('+xy.map(x=>Number(x.toFixed(6))).join(', ')+')';
const color=(energy,alpha)=>'Color('+[energy,energy,energy,alpha].map(x=>Number(x.toFixed(6))).join(', ')+')';
const keyTimes=k=>k.map(x=>round(x.t));
const list=x=>x.join(', ');
const validPoseSequence=s=>Array.isArray(s)&&s.length===N&&s.join('|')===AUTHORED.join('|');

/** Alternate which sprite owns the visible pose, so updates always occur on
 * the HIDDEN sprite at each 125ms boundary. This avoids opacity reset flashes. */
export function sampleR9dFlameMix({sequence,timeSeconds}={}){
 if(!validPoseSequence(sequence)||!Number.isFinite(timeSeconds)||
    timeSeconds<0||timeSeconds>2)fail('invalid flame schedule or time');
 const t=timeSeconds===2?0:timeSeconds;
 const index=Math.min(15,Math.floor(t/PHASE));
 const inSlot=t-index*PHASE;
 const blend=fadeWeight((inSlot-HOLD)/FADE);
 const a=sequence[index],b=sequence[(index+1)%N];
 if(index%2===0)return Object.freeze({
  phase:index,primary:{pose:a,alpha:1-blend},
  secondary:{pose:b,alpha:blend}
 });
 return Object.freeze({
  phase:index,primary:{pose:b,alpha:blend},
  secondary:{pose:a,alpha:1-blend}
 });
}
function makeTrack(index,path,keys,{discrete}){
 if(keys.length<2)fail('empty animation tracks');
 const times=keyTimes(keys);
 if(times.some((t,i)=>i>0&&t<=times[i-1]))
  fail('non-increasing Godot track time');
 return [
  'tracks/'+index+'/type = "value"',
  'tracks/'+index+'/imported = false',
  'tracks/'+index+'/enabled = true',
  'tracks/'+index+'/path = NodePath('+JSON.stringify(path)+')',
  'tracks/'+index+'/interp = '+(discrete?0:1),
  'tracks/'+index+'/loop_wrap = true',
  'tracks/'+index+'/keys = {',
  '"times": PackedFloat32Array('+list(times)+'),',
  '"transitions": PackedFloat32Array('+list(times.map(()=>1))+'),',
  '"update": '+(discrete?1:0)+',',
  '"values": ['+list(keys.map(k=>k.value))+']',
  '}',''
 ].join('\n');
}
function extractTrackSegments(block){
 const hits=[...block.matchAll(/^tracks\/(\d+)\/type = "value"$/gm)];
 if(hits.length!==12||hits.some((m,i)=>Number(m[1])!==i))
  fail('unrecognized original animation track inventory');
 const prefix=block.slice(0,hits[0].index);
 if(!prefix.includes('length = 2')||!prefix.includes('loop_mode = 1'))
  fail('unexpected clip duration or looping');
 const segments=hits.map((hit,i)=>block.slice(hit.index,i+1<hits.length?hits[i+1].index:block.length));
 const path=segments.map((segment,i)=>{
  const m=segment.match(new RegExp('^tracks/'+i+'/path = NodePath\\("([^"]+)"\\)$','m'));
  if(!m||!segment.includes('tracks/'+i+'/keys = {')||
     !segment.includes('"times": PackedFloat32Array(')||
     !segment.includes('"values": ['))
   fail('unknown track schema');
  return m[1];
 });
 if(path[10]!=='body/flame/Sprite2D:texture'||
    path[11]!=='body/flame/Sprite2D:position'||
    new Set(path).size!==path.length||
    segments[10].indexOf('"update": 1')<0||
    segments[11].indexOf('"update": 1')<0)
   fail('flame source tracks cannot be reliably replaced');
 return {prefix,segments,path};
}
function validate({scene,atlas,rig,presentation,durationSeconds}){
 if(typeof scene!=='string'||scene.length>300000||
    !atlas||verifyAtlas(atlas).ok!==true||
    rig?.frameSequence?.fps!==8||
    !validPoseSequence(rig.frameSequence?.frames)||
    durationSeconds!==2||
    presentation?.provenance?.atlasSha256!==atlas.atlasSha256||
    presentation?.artisticReview!=='UNSCORED'||
    presentation?.exportAllowed!==false)
  fail('invalid source, rig, atlas or rights metadata');
 if(scene.includes('SpriteBlend2D')||
    (scene.match(/\[node name="FrontCageRail" type="Sprite2D" parent="body"\]/g)||[]).length!==1||
    !/\[node name="FrontCageRail" type="Sprite2D" parent="body"\][^[]*z_index = 6/.test(scene)||
    (scene.match(/\[node name="Sprite2D" type="Sprite2D" parent="body\/flame"\]/g)||[]).length!==1||
    scene.indexOf('[sub_resource type="Animation" id="Animation_idle"]')<0||
    scene.indexOf('[sub_resource type="AnimationLibrary" id="AnimationLibrary_main"]')<0)
  fail('unexpected Godot scene hierarchy or depth ordering');
 for(const pose of POSES){
  const rid='Atlas_flame_'+pose;
  if((scene.match(new RegExp('\\[sub_resource type="AtlasTexture" id="'+rid+'"\\]','g'))||[]).length!==1||
     atlas.regions.filter(x=>x.partId==='flame'&&x.poseId===pose).length!==1)
    fail('unknown or duplicated texture atlas resource '+pose);
  const corr=presentation.correctionByPose?.[pose];
  const source=atlas.regions.find(x=>x.partId==='flame'&&x.poseId===pose);
  if(!corr||!Array.isArray(corr.correctedSpriteOffset)||corr.correctedSpriteOffset.length!==2||
     !Array.isArray(corr.offsetRuntime)||corr.offsetRuntime.length!==2||
     corr.offsetRuntime.some(v=>!Number.isFinite(v)||Math.abs(v)>2)||
     corr.correctedSpriteOffset.some((v,i)=>!Number.isFinite(v)||
      Math.abs(v-source.localSpriteOffset[i])>2.000001)||
     !Number.isFinite(corr.intensity)||corr.intensity<.9||corr.intensity>1.1)
    fail('untrusted pose presentation correction');
 }
}
export function transformR9dFlameScene({scene,atlas,rig,presentation,durationSeconds=2}={}){
 validate({scene,atlas,rig,presentation,durationSeconds});
 const mark='[sub_resource type="Animation" id="Animation_idle"]';
 const after='[sub_resource type="AnimationLibrary" id="AnimationLibrary_main"]';
 const start=scene.indexOf(mark),stop=scene.indexOf(after,start);
 if(start<0||stop<0||scene.indexOf(mark,start+1)>=0)
  fail('duplicated/missing clip source');
 const clip=scene.slice(start,stop),{prefix,segments}=extractTrackSegments(clip);
 const sequence=rig.frameSequence.frames;
 const originalLight=rig.animations?.find(a=>a.id==='idle')?.tracks?.filter(t=>t.part==='flame'&&t.property==='light_energy');
 if(!Array.isArray(originalLight)||originalLight.length!==1||!Array.isArray(originalLight[0].keys)||
    originalLight[0].keys.length<3)fail('missing original SpiritLight energy motion');
 const energyKeys=originalLight[0].keys;
 if(energyKeys[0]?.time!==0||energyKeys.at(-1)?.time!==2||
    energyKeys.some((k,i)=>!Number.isFinite(k.time)||!Number.isFinite(k.value)||
      k.value<0.6||k.value>1.3||(i>0&&k.time<=energyKeys[i-1].time)))
  fail('invalid SpiritLight energy keyframes');
 const energyIndex=extractTrackSegments(clip).path.indexOf('body/flame/SpiritLight:energy');
 if(energyIndex<0)fail('original light energy track missing in Godot scene');
 const actualEnergySegment=segments[energyIndex];
 const timeMatch=actualEnergySegment.match(/"times": PackedFloat32Array\(([^)]*)\)/);
 const energyMatch=actualEnergySegment.match(/"values": \[([^\]]*)\]/);
 if(!timeMatch||!energyMatch)fail('unreadable Godot source light energy');
 const actualTimes=timeMatch[1].split(',').map(s=>Number(s.trim()));
 const actualEnergies=energyMatch[1].split(',').map(s=>Number(s.trim()));
 if(actualTimes.length<energyKeys.length||actualTimes.length!==actualEnergies.length||
    actualTimes[0]!==0||actualTimes.at(-1)!==2||
    actualTimes.some((t,i)=>!Number.isFinite(t)||!Number.isFinite(actualEnergies[i])||
      (i>0&&t<=actualTimes[i-1]))||
    energyKeys.some(e=>{
     const index=actualTimes.findIndex(t=>Math.abs(t-e.time)<=0.000001);
     return index<0||Math.abs(actualEnergies[index]-e.value)>0.00001;
    }))
  fail('untrusted baked Godot energy differs from authored source');
 const minLight=Math.min(...energyKeys.map(k=>k.value));
 const maxLight=Math.max(...energyKeys.map(k=>k.value));
 if(maxLight-minLight<.1||
    actualEnergies.some(e=>e<minLight-.0001||e>maxLight+.0001))
  fail('baked light values exceed trusted original envelope');
 // Real R9d-06 vs first R9d-07 Godot A/B exposed a 52% cyan-area loss
 // and >2x new pulse variability. Keep the signal synced but restrained.
 const lightAlpha=value=>round(.64+.08*(value-minLight)/(maxLight-minLight));
 const underlightKeys=actualTimes.map((t,i)=>({t,value:color(1,lightAlpha(actualEnergies[i]))}));
 const regions=new Map(atlas.regions.filter(x=>x.partId==='flame'&&x.poseId!==null).map(x=>[x.poseId,x]));
 const coeff=pose=>presentation.correctionByPose[pose];
 const textureFor=pose=>'SubResource("Atlas_flame_'+pose+'")';
 const phaseKeys={primary:[],secondary:[]};
 const opacityKeys={primary:[],secondary:[]};
 for(let i=0;i<N;i++){
  const t=round(i*PHASE),hold=round(t+HOLD),end=round(t+PHASE);
  const current=sequence[i],next=sequence[(i+1)%N];
  // At every boundary the hidden sprite gets the next pose. The previously
  // visible sprite keeps its texture until its next hidden interval.
  const primary=i%2===0?current:next;
  const secondary=i%2===0?next:current;
  for(const [name,pose] of [['primary',primary],['secondary',secondary]])
   phaseKeys[name].push({t,pose});
  const primaryAtStart=i%2===0?1:0,primaryAtEnd=1-primaryAtStart;
  for(const [name,a,b] of [['primary',primaryAtStart,primaryAtEnd],
   ['secondary',1-primaryAtStart,1-primaryAtEnd]]){
    if(i===0)opacityKeys[name].push({t,value:color(coeff(phaseKeys[name].at(-1).pose).intensity,a)});
    opacityKeys[name].push({t:hold,value:color(coeff(phaseKeys[name].at(-1).pose).intensity,a)});
    for(const progress of [.38,.44,.5,.56,.62,1]){
     const tKey=round(hold+progress*FADE);
     const w=fadeWeight(progress);
     opacityKeys[name].push({t:tKey,value:color(
      coeff(phaseKeys[name].at(-1).pose).intensity,a+(b-a)*w)});
    }
  }
 }
 const tracks=[];
 for(const [name,node] of [['primary','body/flame/Sprite2D'],['secondary','body/flame/SpriteBlend2D']]){
  const items=phaseKeys[name];
  tracks.push({path:node+':texture',discrete:true,keys:items.map(({t,pose})=>({t,value:textureFor(pose)}))});
  tracks.push({path:node+':position',discrete:true,keys:items.map(({t,pose})=>({t,value:v2(coeff(pose).correctedSpriteOffset)}))});
 }
 for(const [name,node] of [['primary','body/flame/Sprite2D'],['secondary','body/flame/SpriteBlend2D']]){
  tracks.push({path:node+':modulate',discrete:false,keys:opacityKeys[name]});
 }
 tracks.push({path:'body/CavityUnderlight:modulate',discrete:false,keys:underlightKeys});
 // Exact preservation of every unrelated track, including body motion, swing,
 // current SpiritLight and any non-flame transform.
 const rewritten=prefix+segments.slice(0,10).join('')+
  tracks.map((track,i)=>makeTrack(10+i,track.path,track.keys,{discrete:track.discrete})).join('');
 const fragment=scene.slice(0,start)+rewritten+scene.slice(stop);
 const secondary='\n[node name="SpriteBlend2D" type="Sprite2D" parent="body/flame"]\n'+
  'texture = '+textureFor(sequence[1])+'\n'+
  'position = '+v2(coeff(sequence[1]).correctedSpriteOffset)+'\n'+
  'modulate = Color(1, 1, 1, 0)\n';
 const out=fragment+secondary;
 if((out.match(/tracks\/\d+\/type = "value"/g)||[]).length!==17||
    (out.match(/\[node name="SpriteBlend2D"/g)||[]).length!==1)
   fail('animation scene/resource count failure');
 const positions={};
 for(const pose of POSES)positions[pose]=[...coeff(pose).correctedSpriteOffset];
 return Object.freeze({
  scene:out,trackEvidence:Object.freeze({
   phaseCount:N,transitionMs:55,durationSeconds:2,
   overlapConstrainedMs:round(FADE*(OVERLAP_END-OVERLAP_START)*1000),
   ghostEasing:'BOUNDED_SMOOTHSTEP_38_62',
   underlightTrack:Object.freeze({
    source:'body/flame/SpiritLight:energy',
    path:'body/CavityUnderlight:modulate',
    times:Object.freeze([...actualTimes]),
    alpha:Object.freeze(actualEnergies.map(v=>lightAlpha(v))),
    authoredKeyTimes:Object.freeze(energyKeys.map(k=>k.time)),
    maxOpacity:.72
   }),
   authoredPoses:Object.freeze([...sequence]),
   wrap:'C_TO_A',sourceAtlasSha256:atlas.atlasSha256,
   secondaryNode:'body/flame/SpriteBlend2D',
   primaryNode:'body/flame/Sprite2D',correctedOffsets:positions,
   paintPixelsUnchanged:true,artisticReview:'UNSCORED',
   commercialRightsCleared:false,exportAllowed:false
  })
 });
}
