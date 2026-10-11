import {validateCutout} from '../cutout/validate.mjs';
import {verifyAtlas} from '../cutout/atlas.mjs';
import {selectPartDocument} from '../cutout/compile.mjs';
import {renderSvg} from '../core/render-svg.mjs';

const safe=/^[a-z][a-z0-9_]{0,63}$/;
const gd=x=>JSON.stringify(String(x));
const v2=([x,y])=>'Vector2('+x+', '+y+')';
const rect=({x,y,width,height})=>'Rect2('+[x,y,width,height].join(', ')+')';
const rid=r=>'Atlas_'+r.partId+'_'+(r.poseId??'base');
const rel=id=>'assets/'+id+'/';
const pathOf=(id,byId)=>{
 const stack=[],seen=new Set();let part=byId.get(id);
 while(part){if(seen.has(part.id))throw Error('cutout cycle');seen.add(part.id);stack.unshift(part.id);part=part.parent?byId.get(part.parent):null}
 return stack.join('/');
};
const depth=(part,byId)=>{let n=0,c=part;while(c.parent){n++;c=byId.get(c.parent)}return n};
const color=value=>{const s=(value??'#72f5ec').slice(1);return 'Color('+[0,2,4].map(k=>parseInt(s.slice(k,k+2),16)/255).join(', ')+', 1)'};
// Godot Animation value tracks interpolate linearly, but the source IR can specify
// smoothstep. Bake curves into bounded 30 Hz keys to preserve authored timing.
function bakedKeys(track,length){
 if(track.interpolation!=='smoothstep')return track.keys;
 const count=Math.ceil(length*30);
 if(count>1800)throw new Error('ANIMATION_KEYFRAME_BUDGET_EXCEEDED: clip duration');
 const times=[...new Set([
  ...track.keys.map(k=>k.time),
  ...Array.from({length:count+1},(_,i)=>Math.min(length,i/30)),
  length
 ])].sort((a,b)=>a-b);
 if(times.length>1866)throw new Error('ANIMATION_KEYFRAME_BUDGET_EXCEEDED: smoothstep sampling');
 return times.map(time=>{
  let left=track.keys[0],right=track.keys.at(-1);
  for(let i=1;i<track.keys.length;i++){
   if(time<=track.keys[i].time){right=track.keys[i];left=track.keys[i-1];break}
  }
  let u=right.time===left.time?0:(time-left.time)/(right.time-left.time);
  u=Math.max(0,Math.min(1,u));const t=u*u*(3-2*u);
  const value=Array.isArray(left.value)
   ?left.value.map((v,i)=>v+(right.value[i]-v)*t)
   :left.value+(right.value-left.value)*t;
  return {time,value};
 });
}

function putTracks(lines,tracks){
 tracks.forEach((track,i)=>{
  const times=track.keys.map(k=>k.time);
  const vals=track.keys.map(k=>k.value);
  lines.push('tracks/'+i+'/type = "value"');
  lines.push('tracks/'+i+'/imported = false');
  lines.push('tracks/'+i+'/enabled = true');
  lines.push('tracks/'+i+'/path = NodePath('+gd(track.path)+')');
  lines.push('tracks/'+i+'/interp = '+(track.discrete?0:1));
  lines.push('tracks/'+i+'/loop_wrap = true');
  lines.push('tracks/'+i+'/keys = {');
  lines.push('"times": PackedFloat32Array('+times.join(', ')+'),');
  lines.push('"transitions": PackedFloat32Array('+times.map(()=>1).join(', ')+'),');
  lines.push('"update": '+(track.discrete?1:0)+',');
  lines.push('"values": ['+vals.join(', ')+']');
  lines.push('}');
 });
}
function lightSvg(hex){
 return ['<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
 '<defs><radialGradient id="l"><stop offset="0" stop-color="'+hex+'" stop-opacity="0.9"/>',
 '<stop offset="0.5" stop-color="'+hex+'" stop-opacity="0.35"/>',
 '<stop offset="1" stop-color="'+hex+'" stop-opacity="0"/></radialGradient></defs>',
 '<rect width="64" height="64" fill="url(#l)"/></svg>'].join('\n');
}
function validationScript(parts,byId,hasLight,hasCollision){
 const lines=['extends Node2D','','func _ready() -> void:',
 '    var lantern: Node2D = get_node("SpiritLantern") as Node2D',
 '    var required_paths: Array[String] = ['];
 for(const part of parts)lines.push('        '+gd(pathOf(part.id,byId))+',');
 lines.push('    ]','    for p: String in required_paths:',
 '        if lantern.get_node_or_null(NodePath(p)) == null:',
 '            push_error("Missing cutout part: " + p)','            get_tree().quit(1)','            return',
 '    var player: AnimationPlayer = lantern.get_node("AnimationPlayer") as AnimationPlayer',
 '    if player == null or not player.has_animation("idle"):',
 '        push_error("Missing idle animation")','        get_tree().quit(1)','        return');
 if(hasLight)lines.push('    if lantern.get_node_or_null('+gd(pathOf(hasLight.part,byId)+'/SpiritLight')+') == null:',
 '        push_error("Missing spirit light")','        get_tree().quit(1)','        return');
 if(hasCollision)lines.push('    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:',
 '        push_error("Missing interaction collision")','        get_tree().quit(1)','        return');
 lines.push('    print("GAME_ARTIST_PHASE3_OK")','    get_tree().quit(0)','');
 return lines.join('\n');
}
export function buildGodotV2Project(compiled,atlas,qa){
 const {manifest,source}=compiled??{};
 if(!source||manifest?.version!==2||!safe.test(manifest.assetId))throw Error('invalid v2 asset');
 const checked=validateCutout(source,manifest);
 if(!checked.ok)throw Error('invalid v2 cutout: '+checked.errors.join('; '));
 const verified=verifyAtlas(atlas);
 if(!verified.ok)throw Error('invalid atlas: '+verified.errors.join('; '));
 if(qa?.ok!==true)throw Error('animation QA failed');
 if(compiled.sourceSha256!==atlas.sourceSha256||compiled.sourceRevision!==atlas.sourceRevision)throw Error('source revision mismatch with atlas');
 const byId=new Map(manifest.parts.map(p=>[p.id,p]));
 const root=rel(manifest.assetId);
 const files=new Map(),add=(key,value)=>{if(key.includes('..')||key.startsWith('/')||files.has(key))throw Error('unsafe resource path');files.set(key,value)};
 add('project.godot',[
 'config_version=5','','[application]','config/name="Game Artist Phase 3"',
 'run/main_scene="res://main.tscn"','','[display]',
 'window/size/viewport_width=512','window/size/viewport_height=512','',
 '[rendering]','renderer/rendering_method="gl_compatibility"',
 'renderer/rendering_method.mobile="gl_compatibility"',''].join('\n'));
 add(root+'atlas.png',atlas.png);
 add(root+'atlas.json',JSON.stringify({
  version:2,sourceRevision:compiled.sourceRevision,sourceSha256:compiled.sourceSha256,
  manifestSha256:compiled.manifestSha256,atlasSha256:atlas.atlasSha256,
  atlasWidth:atlas.atlasWidth,atlasHeight:atlas.atlasHeight,regions:atlas.regions
 },null,2)+'\n');
 add(root+'asset.json',JSON.stringify({
  version:2,assetId:manifest.assetId,sourceRevision:compiled.sourceRevision,
  sourceSha256:compiled.sourceSha256,manifestSha256:compiled.manifestSha256,atlasSha256:atlas.atlasSha256,
  parts:manifest.parts.length,animations:manifest.animations.length,qa
 },null,2)+'\n');
 add(root+'source.json',JSON.stringify(source,null,2)+'\n');
 add(root+'cutout.json',JSON.stringify(manifest,null,2)+'\n');
 for(const region of atlas.regions){
  const name=region.partId+'_'+(region.poseId??'base');
  add(root+'sources/'+name+'.svg',renderSvg(selectPartDocument(compiled,region.partId,region.poseId)));
 }
 if(manifest.light)add(root+'light.svg',lightSvg(manifest.light.color));
 const scene=[];
 const ext=['[ext_resource type="Texture2D" path="res://'+root+'atlas.png" id="AtlasSource"]'];
 if(manifest.light)ext.push('[ext_resource type="Texture2D" path="res://'+root+'light.svg" id="LightSource"]');
 const sub=[];
 for(const region of atlas.regions){
  sub.push('[sub_resource type="AtlasTexture" id="'+rid(region)+'"]');
  sub.push('atlas = ExtResource("AtlasSource")');
  sub.push('region = '+rect(region.textureRect));
  sub.push('filter_clip = true','');
 }
 const trackResources=[];
 const locate=(part,poseId=null)=>{
  const found=atlas.regions.find(r=>r.partId===part&&r.poseId===(poseId??null));
  if(!found)throw Error('missing atlas region for '+part+'/'+poseId);
  return found;
 };
 for(const clip of manifest.animations){
  const tracks=[];
  let bakedBudget=0;
  for(const track of clip.tracks){
   const basePath=pathOf(track.part,byId);
   const animationKeys=bakedKeys(track,clip.length);
   bakedBudget+=animationKeys.length;
   if(bakedBudget>8192)throw new Error('ANIMATION_KEYFRAME_BUDGET_EXCEEDED: aggregate tracks');
   const mapped=animationKeys.map(k=>{
    if(track.property==='position'){
     const target=byId.get(track.part);
     const parentPivot=target.parent?byId.get(target.parent).pivot:[0,0];
     return v2([
      target.pivot[0]-parentPivot[0]+k.value[0],
      target.pivot[1]-parentPivot[1]+k.value[1]
     ]);
    }
    if(track.property==='scale')return v2(k.value);
    return String(k.value);
   });
   tracks.push({path:track.property==='light_energy'?basePath+'/SpiritLight:energy':basePath+':'+track.property,
    keys:animationKeys.map((k,i)=>({time:k.time,value:mapped[i]})),discrete:false});
  }
  const seq=manifest.frameSequence;
  if(seq&&seq.frames.length){
   const times=Array.from({length:Math.ceil(clip.length*seq.fps)},(_,i)=>i/seq.fps).filter(t=>t<clip.length);
   const frameKeys=times.map((t,i)=>({time:t,pose:seq.frames[i%seq.frames.length]}));
   const partPath=pathOf(seq.part,byId)+'/Sprite2D';
   tracks.push({path:partPath+':texture',keys:frameKeys.map(k=>({time:k.time,value:'SubResource("'+rid(locate(seq.part,k.pose))+'")'})),discrete:true});
   tracks.push({path:partPath+':position',keys:frameKeys.map(k=>({time:k.time,value:v2(locate(seq.part,k.pose).localSpriteOffset)})),discrete:true});
  }
  const lines=['[sub_resource type="Animation" id="Animation_'+clip.id+'"]',
   'resource_name = '+gd(clip.id),'length = '+clip.length,'loop_mode = 1'];
  putTracks(lines,tracks);
  trackResources.push(lines.join('\n'));
 }
 sub.push(...trackResources);
 sub.push('[sub_resource type="AnimationLibrary" id="AnimationLibrary_main"]');
 sub.push('_data = {');
 for(let i=0;i<manifest.animations.length;i++)sub.push('&"'+manifest.animations[i].id+'": SubResource("Animation_'+manifest.animations[i].id+'")'+(i+1<manifest.animations.length?',':''));
 sub.push('}','');
 if(manifest.collision)sub.push('[sub_resource type="RectangleShape2D" id="CollisionShape2D_main"]','size = '+v2(manifest.collision.size),'');
 const resourceCount=1+ext.length+atlas.regions.length+trackResources.length+1+(manifest.collision?1:0);
 scene.push('[gd_scene load_steps='+resourceCount+' format=3]','',...ext,'',...sub);
 scene.push('[node name="SpiritLantern" type="Node2D"]');
 const parts=[...manifest.parts].sort((a,b)=>depth(a,byId)-depth(b,byId)||a.id.localeCompare(b.id));
 for(const part of parts){
  const path=pathOf(part.id,byId);
  const parent=part.parent?pathOf(part.parent,byId):'.';
  const parentPivot=part.parent?byId.get(part.parent).pivot:[0,0];
  const base=locate(part.id);
  scene.push('','[node name="'+part.id+'" type="Node2D" parent="'+parent+'"]',
   'position = '+v2([part.pivot[0]-parentPivot[0],part.pivot[1]-parentPivot[1]]),
   'z_index = '+part.zIndex,
   '','[node name="Sprite2D" type="Sprite2D" parent="'+path+'"]',
   'texture = SubResource("'+rid(base)+'")',
   'position = '+v2(base.localSpriteOffset));
 }
 if(manifest.light){
  const l=manifest.light,owner=byId.get(l.part);
  scene.push('','[node name="SpiritLight" type="PointLight2D" parent="'+pathOf(l.part,byId)+'"]',
   'position = '+v2([l.position[0]-owner.pivot[0],l.position[1]-owner.pivot[1]]),
   'texture = ExtResource("LightSource")','color = '+color(l.color),
   'energy = '+l.energy,'texture_scale = '+l.textureScale);
 }
 if(manifest.collision){
  scene.push('','[node name="Interaction" type="Area2D" parent="."]',
   'position = '+v2(manifest.collision.position),
   '','[node name="CollisionShape2D" type="CollisionShape2D" parent="Interaction"]',
   'shape = SubResource("CollisionShape2D_main")');
 }
 scene.push('','[node name="AnimationPlayer" type="AnimationPlayer" parent="."]','root_node = NodePath("..")',
  'libraries = {','&"": SubResource("AnimationLibrary_main")','}',
  'autoplay = '+gd(manifest.animations[0].id));
 add(root+'spirit_lantern.tscn',scene.join('\n')+'\n');
 add('validation.gd',validationScript(manifest.parts,byId,manifest.light,manifest.collision));
 add('main.tscn',[
 '[gd_scene load_steps=3 format=3]','',
 '[ext_resource type="PackedScene" path="res://'+root+'spirit_lantern.tscn" id="LanternScene"]',
 '[ext_resource type="Script" path="res://validation.gd" id="ValidateScene"]','',
 '[node name="Validation" type="Node2D"]','script = ExtResource("ValidateScene")','',
 '[node name="SpiritLantern" parent="." instance=ExtResource("LanternScene")]',''].join('\n'));
 return files;
}
