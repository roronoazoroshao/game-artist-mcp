import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {compileCutout} from '../src/cutout/compile.mjs';
import {buildR9dMaster} from '../src/ai-art/r9d-master.mjs';
import {buildGodotRasterCutout} from '../src/export/godot-raster-cutout.mjs';
import {planR9dFlamePresentation} from '../src/ai-art/r9d-flame-polish.mjs';

const root=resolve('examples/spirit-lantern');
const sources=join(root,'r9d/parts/sources');
const custody=JSON.parse(await readFile(join(sources,'source-custody-001.json'),'utf8'));
const sourcePngs=new Map();
for(const row of custody.sources){
 sourcePngs.set(row.partId,await readFile(join(sources,row.partId+'.png')));
}
const canonical=JSON.parse(await readFile(join(root,'v2/source.json'),'utf8'));
const rig=JSON.parse(await readFile(join(root,'v2/cutout.json'),'utf8'));
const compiled=compileCutout(canonical,rig,{revision:1});
const master=buildR9dMaster({sourcePngs,custody});
const {atlas}=buildGodotRasterCutout({
 ora:master.ora,compiled,bindings:master.bindings,
 ownership:master.ownership,origin:'R9A_IMPORTED_UNATTESTED'
});
const presentation=planR9dFlamePresentation({master,atlas,rig:compiled.manifest,options:{custody}});
const report={
 version:1,checkpoint:'R9D05_BASELINE_SOURCE_METRICS_NOT_GAMEPLAY_REVIEW',
 assetId:'spirit_lantern',masterSha256:master.oraSha256,
 atlasSha256:atlas.atlasSha256,canvas:{width:1024,height:1280},
 runtimeCanvas:{width:256,height:320},poseMetrics:presentation.poseSlots,
 preliminaryCorrectionByPose:presentation.correctionByPose,
 authoredFrames:presentation.provenance.authoredFrames,
 providerOriginalAttested:false,
 measuredBy:'REAL_ADOBE_PNG_MASTER_ALPHA_CYAN',
 godotFramebufferMetrics:'PENDING_REAL_ENGINE_COMPARISON',
 artisticReview:'UNSCORED',rightsVerified:false,exportAllowed:false
};
const target=resolve('examples/spirit-lantern/generated/r9d-06-baseline');
await mkdir(target,{recursive:true});
await writeFile(join(target,'baseline-source-metrics.json'),JSON.stringify(report,null,2)+'\n');
console.log('GAME_ARTIST_R9D06_FROZEN_SOURCE_BASELINE_MEASURED');
console.log(JSON.stringify({masterSha256:report.masterSha256,atlasSha256:report.atlasSha256,poseCount:report.poseMetrics.length,artisticReview:report.artisticReview}));
