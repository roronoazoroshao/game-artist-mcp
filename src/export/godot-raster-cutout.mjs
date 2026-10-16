import {renderRasterFrames} from '../ai-art/raster-frame-provider.mjs';
import {packAtlas,verifyAtlas} from '../cutout/atlas.mjs';
import {auditLoop} from '../cutout/animation.mjs';
import {buildGodotV2Project} from './godot-cutout-v2.mjs';

const fail=reason=>{throw Error('R9C_GODOT_REJECTED: '+reason)};
const expectedOrigin=new Set(['LEGACY_VECTOR_RASTER_TECHNICAL','R9A_IMPORTED_UNATTESTED']);

/**
 * Opt-in raster pipeline.
 * The existing vector compiled object is the RIG AUTHORITY for pivots, animation
 * and collision. The content hash/atlas frames here come exclusively from
 * original PNG paint layers inside the accepted ORA, never SVG frame renders.
 *
 * Reuse the existing Godot scene writer for unchanged AnimationPlayer
 * semantics; remove any SVG frame backup source immediately from the map.
 * Keep light.svg: this is a light texture, not cutout paint.
 */
export function buildGodotRasterCutout({ora,compiled,bindings,ownership,origin}={}){
 const prepared=renderRasterFrames({ora,compiled,bindings,ownership});
 if(!expectedOrigin.has(origin)||origin!==prepared.origin)fail('unattested raster provenance/origin');
 const qa=auditLoop(compiled,'idle');
 if(qa.ok!==true)fail('rig animation loop failed');
 const atlas=packAtlas(prepared.frames,{
  maxAtlasSize:compiled.manifest.rendering.maxAtlasSize,
  paddingPx:compiled.manifest.rendering.paddingPx
 });
 if(!verifyAtlas(atlas).ok)fail('raster atlas verification failed');
 // The legacy builder only uses the compiled ArtDocument as an authority to
 // verify the rig and to emit fallback SVG backups; it never renders those
 // SVGs to produce atlas frames in this opt-in path.
 const rigAuthority={...compiled,sourceSha256:prepared.sourceSha256};
 const files=buildGodotV2Project(rigAuthority,atlas,qa);
 const assetPath='assets/'+compiled.manifest.assetId+'/';
 for(const key of [...files.keys()]){
  if(key.startsWith(assetPath+'sources/')&&key.endsWith('.svg'))
   files.delete(key);
 }
 files.delete(assetPath+'source.json'); // prevent vector source masquerading as imported raster
 files.set(assetPath+'raster-source.json',JSON.stringify({
  version:1,origin:prepared.origin,oraSha256:prepared.sourceSha256,
  rigSourceSha256:prepared.rigSourceSha256,
  rigManifestSha256:compiled.manifestSha256,
  masterCanvas:{width:prepared.masterWidth,height:prepared.masterHeight},
  runtimeCanvas:prepared.runtimeCanvas,
  paintedByAI:false,artisticReview:'UNSCORED',
  commercialRightsCleared:false,exportAllowed:false,
  layerBindings:Object.fromEntries([...bindings].map(([k,ids])=>[k,[...ids]]))
 },null,2)+'\n');
 const legacyAsset=JSON.parse(files.get(assetPath+'asset.json'));
 files.set(assetPath+'asset.json',JSON.stringify({
  ...legacyAsset,sourceType:'ORIGINAL_RASTER_PNG_LAYERS',
  paintedByAI:false,origin:prepared.origin,artisticReview:'UNSCORED',
  commercialRightsCleared:false,exportAllowed:false,
  rigSourceSha256:prepared.rigSourceSha256
 },null,2)+'\n');
 const evidence=Object.freeze({
  origin:prepared.origin,paintedByAI:false,artisticReview:'UNSCORED',
  rightsStatus:'UNVERIFIED',exportAllowed:false,sourceSha256:prepared.sourceSha256,
  atlasSha256:atlas.atlasSha256,frameCount:prepared.frames.length,
  rigManifestSha256:compiled.manifestSha256
 });
 return {files,atlas,evidence,frames:prepared.frames};
}
