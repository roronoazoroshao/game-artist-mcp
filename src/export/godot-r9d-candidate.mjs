import {buildR9dMaster} from '../ai-art/r9d-master.mjs';
import {deriveR9dFrontCageRail} from '../ai-art/r9d-depth-occlusion.mjs';
import {planR9dFlamePresentation} from '../ai-art/r9d-flame-polish.mjs';
import {transformR9dFlameScene} from './r9d-flame-crossfade.mjs';
import {buildGodotRasterCutout} from './godot-raster-cutout.mjs';

const fail=why=>{throw Error('R9D_GODOT_REJECTED: '+why)};
const ROOT='assets/spirit_lantern/';
/**
 * Keep the proven R9c Godot rig builder, but replace its legacy-vector paint
 * semantics with source-byte-bound genuine Adobe painting candidate metadata.
 * This proves game technical playback, not commercial rights or artistic GO.
 */
export function buildR9dCandidateGodotProject({sourcePngs,custody,compiled,hybridFlame=true}={}){
 if(typeof hybridFlame!=='boolean')fail('unsafe R9d baseline selection');
 if(!compiled||compiled.manifest?.assetId!=='spirit_lantern'||
    !Array.isArray(compiled.manifest?.parts)||compiled.manifest.parts.length!==5)
  fail('unrecognized canonical rig manifest');
 const master=buildR9dMaster({sourcePngs,custody});
 const original=buildGodotRasterCutout({
  ora:master.ora,compiled,bindings:master.bindings,ownership:master.ownership,
  origin:'R9A_IMPORTED_UNATTESTED'
 });
 if(original.atlas.regions.length!==9)fail('raster atlas missing flame frames');

 const occlusion=deriveR9dFrontCageRail({
  ora:master.ora,expectedOraSha256:master.oraSha256
 });
 const files=new Map(original.files);
 const scenePath=ROOT+'spirit_lantern.tscn';
 let scene=String(files.get(scenePath));
 const header=scene.match(/\[gd_scene load_steps=(\d+) format=3\]/);
 if(!header||!scene.includes('[sub_resource type="AtlasTexture"')||
    scene.includes('R9dForeground')||!scene.includes('parent="body/flame"'))
   fail('unexpected original Godot scene resource layout');
 scene=scene.replace(header[0],'[gd_scene load_steps='+(Number(header[1])+1)+' format=3]');
 const material='[ext_resource type="Texture2D" path="res://'+
  ROOT+'foreground-rail.png" id="R9dForeground"]\n';
 scene=scene.replace('[sub_resource type="AtlasTexture"',material+
  '\n[sub_resource type="AtlasTexture"');
 scene+='\n[node name="FrontCageRail" type="Sprite2D" parent="body"]\n'+
  'texture = ExtResource("R9dForeground")\n'+
  'centered = false\n'+
  'position = Vector2(-128, -160)\n'+
  'z_index = 6\n';
 files.set(scenePath,scene);
 files.set(ROOT+'foreground-rail.png',occlusion.runtimePng);
 files.set(ROOT+'r9d-occlusion.json',JSON.stringify({
  version:1,type:occlusion.maskType,
  derivedFrom:'R9D_EIGHT_ORIGINAL_ADOBE_BODY_PIXELS_NOT_NEW_ART',
  sourceOraSha256:occlusion.sourceOraSha256,
  sourceBodySha256:occlusion.sourceBodySha256,
  overlaySha256:occlusion.overlaySha256,
  polygonMaster:occlusion.polygon,
  visibleRailPixels:occlusion.visibleRailPixels,
  railOverFlamePixels:occlusion.railOverFlamePixels,
  spritePath:'body/FrontCageRail',zIndex:6,
  sourcePaintUnchanged:true,
  artisticReview:'UNSCORED',commercialRightsCleared:false,
  exportAllowed:false
 },null,2)+'\n');

 if(hybridFlame){
  const presentation=planR9dFlamePresentation({
   master,atlas:original.atlas,rig:compiled.manifest,options:{custody}
  });
  const transformed=transformR9dFlameScene({
   scene,atlas:original.atlas,rig:compiled.manifest,presentation,
   durationSeconds:2
  });
  scene=transformed.scene;
  const header2=scene.match(/\[gd_scene load_steps=(\d+) format=3\]/);
  if(!header2||!Buffer.isBuffer(presentation.underlightPng)||
     scene.includes('R9dUnderlight')||
     scene.includes('[node name="CavityUnderlight"'))
   fail('unexpected hybrid scene or source-light buffer');
  scene=scene.replace(header2[0],
   '[gd_scene load_steps='+(Number(header2[1])+1)+' format=3]');
  const underlightResource='[ext_resource type="Texture2D" path="res://'+
   ROOT+'flame-underlight.png" id="R9dUnderlight"]\n';
  scene=scene.replace('[sub_resource type="AtlasTexture"',
   underlightResource+'\n[sub_resource type="AtlasTexture"');
  scene+='\n[node name="CavityUnderlight" type="Sprite2D" parent="body"]\n'+
   'texture = ExtResource("R9dUnderlight")\n'+
   'centered = false\n'+
   'position = Vector2(-128, -160)\n'+
   'z_index = 3\n'+
   'modulate = Color(1, 1, 1, '+transformed.trackEvidence.underlightTrack.alpha[0]+')\n';
  files.set(ROOT+'flame-underlight.png',presentation.underlightPng);
  files.set(ROOT+'r9d-flame-polish.json',JSON.stringify({
   version:2,method:'R9D07_CONTRAST_AND_GHOST_POLISH',
   sourceOraSha256:master.oraSha256,
   atlasSha256:original.atlas.atlasSha256,
   transitionMs:transformed.trackEvidence.transitionMs,
   overlapConstrainedMs:transformed.trackEvidence.overlapConstrainedMs,
   ghostEasing:transformed.trackEvidence.ghostEasing,
   underlightTrack:transformed.trackEvidence.underlightTrack,
   originalPoseSequence:transformed.trackEvidence.authoredPoses,
   wrap:transformed.trackEvidence.wrap,
   poseMetrics:presentation.poseSlots,
   corrections:presentation.correctionByPose,
   underlight:presentation.provenance.underlight,
   underlightNode:'body/CavityUnderlight',
   underlightZ:3,flameZ:4,foregroundRailZ:6,
   sourceArtUnchanged:true,
   providerOriginalAttested:false,commercialRightsCleared:false,
   artisticReview:'UNSCORED',exportAllowed:false
  },null,2)+'\n');
  files.set(scenePath,scene);
 }
 const asset=JSON.parse(files.get(ROOT+'asset.json'));
 const raster=JSON.parse(files.get(ROOT+'raster-source.json'));
 const presentation={
  ...asset,sourceType:'ORIGINAL_AI_PAINTED_INDIVIDUAL_RASTER_CANDIDATES',
  origin:'R9D_FIREFLY_NEW_ART_CANDIDATE_UNATTESTED',
  paintedByAI:true,paintGeneratedBy:'Adobe Firefly',
  providerOriginalAttested:false,
  commercialRightsCleared:false,artisticReview:'UNSCORED',
  exportAllowed:false,productionReady:false,
  hybridFlameTechnicalCandidate:hybridFlame
 };
 files.set(ROOT+'asset.json',JSON.stringify(presentation,null,2)+'\n');
 files.set(ROOT+'raster-source.json',JSON.stringify({
  ...raster,origin:'R9D_FIREFLY_NEW_ART_CANDIDATE_UNATTESTED',
  modelPaintingSource:'ADOBE_FIREFLY_INDIVIDUAL_CANDIDATES',
  paintedByAI:true,providerOriginalAttested:false,
  commercialRightsCleared:false,artisticReview:'UNSCORED',
  exportAllowed:false,productionReady:false
 },null,2)+'\n');
 files.set(ROOT+'r9d-painting-source.json',JSON.stringify({
  version:1,assetId:'spirit_lantern',paintGeneratedBy:'Adobe Firefly',
  orAProjectSha256:master.oraSha256,
  masterCanvas:{width:1024,height:1280},runtimeCanvas:{width:256,height:320},
  sourceCount:master.sourcePaintings.length,
  sourcePaintings:master.sourcePaintings,
  rigPlacements:master.placements,
  sourceAuthentication:master.sourceAuthentication,
  maskFormat:'EDITABLE_DERIVED_ALPHA_PNG_SIDECAR_NOT_NATIVE_KRITA_MASK',
  providerOriginalAttested:false,rigAlignmentStatus:'TECHNICAL_INITIAL_ALIGNMENT_NOT_ARTIST_APPROVED',
  rightsVerified:false,artisticReview:'UNSCORED',exportAllowed:false
 },null,2)+'\n');
 return Object.freeze({
  files,atlas:original.atlas,master,
  evidence:Object.freeze({
   paintGeneratedBy:'Adobe Firefly',sourceAuthenticity:'UNATTESTED_PROVIDER_URL',
   originalSha256:master.oraSha256,
   atlasSha256:original.atlas.atlasSha256,
   frameCount:9,hybridFlameTechnicalCandidate:hybridFlame,
   providerOriginalAttested:false,
   artisticReview:'UNSCORED',commercialRightsCleared:false,
   exportAllowed:false
  })
 });
}
