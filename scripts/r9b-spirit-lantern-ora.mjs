import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compileCutout} from '../src/cutout/compile.mjs';
import {renderCutoutFrames} from '../src/cutout/raster.mjs';
import {writeOpenRaster,readOpenRaster} from '../src/ai-art/openraster.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');

export async function buildSpiritLanternOraDemo(){
 const source=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/source.json'),'utf8'));
 const rig=JSON.parse(await readFile(join(root,'examples/spirit-lantern/v2/cutout.json'),'utf8'));
 const compiled=compileCutout(source,rig,{revision:1});
 const all=await renderCutoutFrames(compiled);
 const layers=[];
 const poses=rig.poseVariants.map(p=>p.id);
 for(const part of [...rig.parts].sort((a,b)=>b.zIndex-a.zIndex)){
  const ids=part.id==='flame'?poses:[null];
  for(const poseId of ids){
   const frame=all.find(f=>f.partId===part.id&&f.poseId===poseId);
   assert.ok(frame,'missing original raster part/pose');
   layers.push({id:part.id+'_'+(poseId??'base'),png:frame.rawPng,
    x:0,y:0,opacity:1,visible:poseId===null||poseId===poses[0]});
  }
 }
 const ora=writeOpenRaster({width:source.canvas.width,height:source.canvas.height,layers});
 const verified=readOpenRaster(ora);
 assert.equal(verified.layers.length,layers.length);
 const evidence={
  origin:'LEGACY_VECTOR_ORA_TECHNICAL',
  paintedByAI:false,
  artisticReview:'UNSCORED',
  assetId:rig.assetId,
  partCount:rig.parts.length,
  flamePoseIds:poses,
  layerCount:layers.length,
  sourceSha256:compiled.sourceSha256,
  manifestSha256:compiled.manifestSha256,
  oraSha256:sha(ora),
  mergedSha256:sha(verified.mergedPng),
  note:'Editable ORA was built from original R8e legacy deterministic part rasters, NOT model-painted new art.'
 };
 return {ora,evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=join(root,'examples/spirit-lantern/generated/r9b-layered-art');
 const result=await buildSpiritLanternOraDemo();
 await mkdir(output,{recursive:true,mode:0o700});
 await writeFile(join(output,'spirit-lantern-r8e-editable-TECHNICAL.ora'),result.ora);
 await writeFile(join(output,'evidence.json'),JSON.stringify(result.evidence,null,2)+'\n');
 console.log('GAME_ARTIST_R9B_ORA_ROUNDTRIP_OK');
 console.log(JSON.stringify({output:'examples/spirit-lantern/generated/r9b-layered-art',...result.evidence}));
}
