#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { applyOperations } from "../core/engine.mjs";
import { renderSvg } from "../core/render-svg.mjs";
import { validateDocument } from "../core/validate.mjs";
import { loadStyleProfile } from "../style/profile.mjs";
import { inspectStyle } from "../style/inspect.mjs";
import { exportGodotCutout } from "../export/godot-cutout.mjs";
import { compileCutout } from "../cutout/compile.mjs";
import { renderCutoutFrames } from "../cutout/raster.mjs";
import { packAtlas } from "../cutout/atlas.mjs";
import { auditLoop } from "../cutout/animation.mjs";
import { buildGodotV2Project } from "../export/godot-cutout-v2.mjs";
import { publishGodotPackage } from "../export/atomic-package.mjs";
import { renderCutoutPreview } from "../cutout/preview.mjs";
import { AssetStore } from "./store.mjs";
import {PaintWorkspace,renderPaint,analyzePaintDifference,renderPaintDiff,evaluatePaintProgress} from "../ai-art/paint-workstation.mjs";
import {GodotPaintObserver} from "../ai-art/godot-paint-observer.mjs";
import { checkRenderBudget, assertPngFileSize } from "./render-budget.mjs";
import { parseUniqueKeysJsonLine } from "./strict-json.mjs";

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_VERSION = "0.0.3";

function parseWorkspace(argv) {
  const index = argv.indexOf("--workspace");
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value) throw new Error("--workspace requires a path");
    return resolve(value);
  }
  return resolve(process.cwd(), ".game-artist-workspace");
}

const workspace = parseWorkspace(process.argv.slice(2));
const store = new AssetStore(workspace);
const painter = new PaintWorkspace(store);
const sceneObserver = new GodotPaintObserver({paint:painter});
await store.init();

function rendererAvailable() {
  const result = spawnSync("rsvg-convert", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

async function renderPng(document) {
  const temp = await mkdtemp(join(tmpdir(), "game-artist-preview-"));
  try {
    const svgPath = join(temp, "preview.svg");
    const pngPath = join(temp, "preview.png");
    const svg=renderSvg(document);
    checkRenderBudget(svg);
    await writeFile(svgPath, svg, "utf8");
    execFileSync("rsvg-convert", ["--format=png", "--output", pngPath, svgPath], {
      stdio: ["ignore", "ignore", "pipe"], timeout: 8000, maxBuffer: 1048576
    });
    assertPngFileSize((await stat(pngPath)).size);
    const png=await readFile(pngPath);
    checkRenderBudget(svg,png);
    return png;
  } catch (error) {
    const detail = error?.stderr?.toString?.().trim();
    throw new Error(detail ? `PNG render failed: ${detail}` : "PNG render failed; rsvg-convert may be unavailable");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

function textResult(value, structuredContent = undefined) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
    ...(structuredContent === undefined ? {} : { structuredContent })
  };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

async function assertSafeLegacyExportOutput(outputDir) {
  // The legacy renderer may overwrite its three named output files.
  // Preflight all destinations before truncating any of them.
  try {
    await mkdir(outputDir, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const directory = await lstat(outputDir);
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new Error("unsafe symlink or legacy export output directory");
  }
  for (const name of ["asset.svg", "asset.png", "report.json"]) {
    const path = join(outputDir, name);
    let entry;
    try { entry = await lstat(path); }
    catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("unsafe symlink or legacy export file: " + name);
    }
  }
}

async function writeLegacyExportFile(path, bytes) {
  // Replace an existing file's directory entry, never truncate its inode:
  // pre-existing hardlinks must not change files outside this export.
  const temp = path + "." + process.pid + "." + randomBytes(12).toString("hex") + ".tmp";
  try {
    const handle = await open(temp, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

const tools = [
  {
    name:"paint_scene_observe",
    description:"Capture an actual Xvfb/OpenGL Godot framebuffer screenshot of a painted revision inside a controlled art-staging scene. Two approved lighting environments, 64/128/512px. This is NOT a full target-game scene or human beauty review.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},revision:{type:"integer",minimum:0},
      size:{enum:[64,128,512]},environment:{enum:["twilight","moonlight"]}},
      required:["asset_id","revision","size","environment"],additionalProperties:false}
  },
  {
    name:"paint_scene_compare",
    description:"Compare actual Godot framebuffer pixels between two paint revisions in the SAME controlled environment. Emits only objective changed-pixel metrics, never Artistic GO.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},baseline_revision:{type:"integer",minimum:0},
      candidate_revision:{type:"integer",minimum:0},size:{enum:[64,128,512]},
      environment:{enum:["twilight","moonlight"]}},
      required:["asset_id","baseline_revision","candidate_revision","size","environment"],additionalProperties:false}
  },
  {
    name:"paint_import_png",
    description:"Import user-provided authored RGBA PNG bytes into a separate editable layer, source hash pinned but copyright UNVERIFIED. PNG is exact-canvas-size noninterlaced RGBA, <=96KiB encoded, canonical base64. No URL/file path.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},expected_revision:{type:"integer",minimum:0},
      layer_id:{type:"string"},image_base64:{type:"string",maxLength:131072},source_label:{type:"string",maxLength:48}},
      required:["asset_id","expected_revision","layer_id","image_base64","source_label"],additionalProperties:false}
  },
  {
    name:"paint_diff_preview",
    description:"Return RGBA heatmap preview highlighting all changed pixels between two saved paint revisions; only technical pixel diff, not perceived artistic quality.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},baseline_revision:{type:"integer",minimum:0},
      candidate_revision:{type:"integer",minimum:0},size:{enum:[64,128]}},
      required:["asset_id","baseline_revision","candidate_revision"],additionalProperties:false}
  },
  {
    name:"paint_evaluate",
    description:"Bounded objective coverage/change stopping rule for a vision-capable agent's paint correction loop. Returns TARGET_MET/REVISION_REQUIRED/BUDGET_EXHAUSTED; never Artistic GO or automatic AI critique.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},baseline_revision:{type:"integer",minimum:0},
      candidate_revision:{type:"integer",minimum:0},size:{enum:[64,128]},min_coverage:{type:"number",minimum:0,maximum:1},
      max_coverage:{type:"number",minimum:0,maximum:1},min_changed_pixels:{type:"integer",minimum:0},
      max_iterations:{type:"integer",minimum:1,maximum:8}},
      required:["asset_id","baseline_revision","candidate_revision"],additionalProperties:false}
  },
  {
    name:"paint_open",description:"Create or resume a versioned native RGBA painting for an existing <=256px game asset.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"}},required:["asset_id"],additionalProperties:false}
  },
  {
    name:"paint_apply",description:"Apply 1-12 deterministic brush/layer instructions under optimistic revision control. stroke.draw requires RGB hex, radius .5..24, opacity 0..1 and pressure points [x,y,pressure]. Supports layer.create, layer.settings (opacity, visible, rectangular mask), stroke.draw and stroke.erase.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},expected_revision:{type:"integer",minimum:0},operations:{type:"array",minItems:1,maxItems:12,items:{type:"object"}}},required:["asset_id","expected_revision","operations"],additionalProperties:false}
  },
  {
    name:"paint_preview",description:"Render exact current or historical brush layers to an image block for AI visual inspection; not an autonomous quality judgment.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},revision:{type:"integer",minimum:0},size:{enum:[64,128]}},required:["asset_id"],additionalProperties:false}
  },
  {
    name:"paint_compare",description:"Return objective changed-pixel/coverage metrics between two historical paint revisions, not artistic scoring.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},baseline_revision:{type:"integer",minimum:0},candidate_revision:{type:"integer",minimum:0},size:{enum:[64,128]}},required:["asset_id","baseline_revision","candidate_revision"],additionalProperties:false}
  },
  {
    name:"paint_restore",description:"Non-destructively revert to a previous paint revision as a new revision; historical edits remain intact.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},expected_revision:{type:"integer",minimum:0},target_revision:{type:"integer",minimum:0}},required:["asset_id","expected_revision","target_revision"],additionalProperties:false}
  },
  {
    name:"paint_export",description:"Publish immutable static Godot4 Sprite2D project + RGBA art.png and rights-UNVERIFIED evidence. Not animated rig and not commercial approval.",
    inputSchema:{type:"object",properties:{asset_id:{type:"string"},expected_revision:{type:"integer",minimum:0}},required:["asset_id","expected_revision"],additionalProperties:false}
  },
  {
    name: "health",
    description: "Return Game Artist MCP health and deterministic renderer readiness.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "asset_create",
    description: "Create a new empty explicit vector art document inside the governed workspace.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,63}$" },
        width: { type: "number", exclusiveMinimum: 0, maximum: 4096 },
        height: { type: "number", exclusiveMinimum: 0, maximum: 4096 }
      },
      required: ["asset_id", "width", "height"],
      additionalProperties: false
    }
  },
  {
    name: "asset_get",
    description: "Read current revision and explicit document for an asset.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        include_history: { type: "boolean" }
      },
      required: ["asset_id"],
      additionalProperties: false
    }
  },
  {
    name: "document_query",
    description: "Read a bounded summary or selected nodes from the current art document.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        ids: { type: "array", maxItems: 64, items: { type: "string" } }
      },
      required: ["asset_id"],
      additionalProperties: false
    }
  },
  {
    name: "document_apply_ops",
    description: "Atomically apply a bounded batch of explicit deterministic art operations with optimistic revision checking.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        expected_revision: { type: "integer", minimum: 0 },
        idempotency_key: { type: "string", maxLength: 128 },
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 50,
          items: { type: "object" }
        }
      },
      required: ["asset_id", "expected_revision", "operations"],
      additionalProperties: false
    }
  },
  {
    name: "render_preview",
    description: "Render the current explicit art document to PNG and return it as an MCP image content block.",
    inputSchema: {
      type: "object",
      properties: { asset_id: { type: "string" } },
      required: ["asset_id"],
      additionalProperties: false
    }
  },
  {
    name: "render_cutout_preview",
    description: "Render one validated Cutout v2 animation frame at the specified local clip time into a bounded PNG image block.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,63}$" },
        cutout: { type: "object" },
        clip_id: { type: "string", pattern: "^[a-z][a-z0-9_]{0,63}$" },
        time_seconds: { type: "number", minimum: 0, maximum: 60 }
      },
      required: ["asset_id","cutout","clip_id","time_seconds"],
      additionalProperties: false
    }
  },
  {
    name: "validate_asset",
    description: "Run deterministic technical validation against the current art document.",
    inputSchema: {
      type: "object",
      properties: { asset_id: { type: "string" } },
      required: ["asset_id"],
      additionalProperties: false
    }
  },
  {
    name: "export_asset",
    description: "Export the current asset to explicit SVG, PNG and machine-readable report files under the governed workspace.",
    inputSchema: {
      type: "object",
      properties: { asset_id: { type: "string" } },
      required: ["asset_id"],
      additionalProperties: false
    }
  },
  {
    name: "export_godot_cutout",
    description: "Export the current explicit art document plus structured cutout metadata into a bounded Godot 4 project.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        cutout: { type: "object" }
      },
      required: ["asset_id", "cutout"],
      additionalProperties: false
    }
  },
  {
    name: "style_profile_get",
    description: "Read a validated, allowlisted artistic style profile without modifying assets.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" }
      },
      required: ["profile_id"],
      additionalProperties: false
    }
  },
  {
    name: "style_validate",
    description: "Check a current art document against an allowlisted style profile without modifying it.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,63}$" },
        profile_id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" }
      },
      required: ["asset_id", "profile_id"],
      additionalProperties: false
    }
  }
];

async function callTool(name, args) {
  switch (name) {
    case "paint_scene_observe":{
      const out=await sceneObserver.observe(args.asset_id,{revision:args.revision,size:args.size,
        environment:args.environment});
      const {png,...meta}=out;
      return {content:[{type:"text",text:JSON.stringify(meta)},
        {type:"image",data:png.toString("base64"),mimeType:"image/png"}],structuredContent:meta};
    }
    case "paint_scene_compare":{
      return textResult(await sceneObserver.compare(args.asset_id,{
        baselineRevision:args.baseline_revision,candidateRevision:args.candidate_revision,
        size:args.size,environment:args.environment}));
    }
    case "paint_import_png":{
      const p=await painter.importPng(args.asset_id,{expectedRevision:args.expected_revision,
       layerId:args.layer_id,imageBase64:args.image_base64,sourceLabel:args.source_label});
      return textResult({asset_id:args.asset_id,revision:p.revision,sourceSha256:p.history.at(-1).operations[0].sourceSha256,
        importedLayer:args.layer_id,rightsVerified:false,artisticReview:"UNSCORED",exportAllowed:false});
    }
    case "paint_diff_preview":{
      const p=await painter.load(args.asset_id),a=args.baseline_revision,b=args.candidate_revision;
      if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>p.revision||b>p.revision)
       throw Error("PAINT_REJECTED: diff revision out of bounds");
      const rev=r=>({...p,revision:r,history:p.history.slice(0,r)});
      const info=renderPaintDiff(rev(a),rev(b),{size:args.size??64});
      const {png,...meta}=info;
      return {content:[{type:"text",text:JSON.stringify(meta)},{type:"image",data:png.toString("base64"),mimeType:"image/png"}],
        structuredContent:meta};
    }
    case "paint_evaluate":{
      const p=await painter.load(args.asset_id),a=args.baseline_revision,b=args.candidate_revision;
      if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>p.revision||b>p.revision)
       throw Error("PAINT_REJECTED: evaluate revision out of bounds");
      const rev=r=>({...p,revision:r,history:p.history.slice(0,r)});
      return textResult(evaluatePaintProgress(rev(a),rev(b),{size:args.size??64,
        minCoverage:args.min_coverage??0,maxCoverage:args.max_coverage??1,
        minChangedPixels:args.min_changed_pixels??1,maxIterations:args.max_iterations??3}));
    }
    case "paint_open":{
      const p=await painter.open(args.asset_id);
      return textResult({asset_id:args.asset_id,revision:p.revision,canvas:[p.width,p.height],
        artisticReview:"UNSCORED",commercialRightsCleared:false,exportAllowed:false});
    }
    case "paint_apply":{
      const p=await painter.apply(args.asset_id,{expectedRevision:args.expected_revision,operations:args.operations});
      return textResult({asset_id:args.asset_id,revision:p.revision,operationCount:p.history.flatMap(h=>h.operations).length,
        artisticReview:"UNSCORED",exportAllowed:false});
    }
    case "paint_preview":{
      const p=await painter.load(args.asset_id);
      const {png,sha256,width,height,metrics,revision}=renderPaint(p,{revision:args.revision??p.revision,size:args.size??null});
      const meta={asset_id:args.asset_id,revision,sha256,width,height,metrics,mime_type:"image/png",
        artisticReview:"UNSCORED",exportAllowed:false};
      return {content:[{type:"text",text:JSON.stringify(meta)},{type:"image",data:png.toString("base64"),mimeType:"image/png"}],structuredContent:meta};
    }
    case "paint_compare":{
      const p=await painter.load(args.asset_id),a=args.baseline_revision,b=args.candidate_revision;
      if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>p.revision||b>p.revision)
        throw Error("PAINT_REJECTED: invalid historical comparison");
      const rev=r=>({...p,revision:r,history:p.history.slice(0,r)});
      return textResult(analyzePaintDifference(rev(a),rev(b),{size:args.size??64}));
    }
    case "paint_restore":{
      const p=await painter.restore(args.asset_id,{expectedRevision:args.expected_revision,targetRevision:args.target_revision});
      return textResult({asset_id:args.asset_id,revision:p.revision,restoredFrom:args.target_revision,
        artisticReview:"UNSCORED",exportAllowed:false});
    }
    case "paint_export":{
      return textResult(await painter.exportGodot(args.asset_id,{expectedRevision:args.expected_revision}));
    }
    case "health":
      return textResult({
        ok: true,
        server: "game-artist-mcp",
        version: SERVER_VERSION,
        protocolVersion: PROTOCOL_VERSION,
        renderer: { rsvg: rendererAvailable() }
      });

    case "asset_create": {
      const state = await store.create(args.asset_id, args.width, args.height);
      return textResult({ asset_id: args.asset_id, revision: state.revision, node_count: 0 });
    }

    case "asset_get": {
      const state = await store.load(args.asset_id);
      const value = {
        asset_id: args.asset_id,
        revision: state.revision,
        document: state.document,
        ...(args.include_history ? { history: state.history.slice(-100) } : {})
      };
      return textResult(value);
    }

    case "document_query": {
      const state = await store.load(args.asset_id);
      const selected = Array.isArray(args.ids)
        ? state.document.nodes.filter((node) => args.ids.includes(node.id))
        : state.document.nodes;
      return textResult({
        asset_id: args.asset_id,
        revision: state.revision,
        canvas: state.document.canvas,
        total_nodes: state.document.nodes.length,
        nodes: selected.slice(0, 200)
      });
    }

    case "document_apply_ops": {
      const current = await store.load(args.asset_id);
      const next = applyOperations(current, {
        expectedRevision: args.expected_revision,
        idempotencyKey: args.idempotency_key ?? null,
        operations: args.operations
      });
      await store.save(args.asset_id, next);
      return textResult({
        asset_id: args.asset_id,
        revision: next.revision,
        node_count: next.document.nodes.length,
        warnings: validateDocument(next.document).warnings
      });
    }

    case "render_preview": {
      const state = await store.load(args.asset_id);
      const png = await renderPng(state.document);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              asset_id: args.asset_id,
              revision: state.revision,
              mime_type: "image/png",
              bytes: png.byteLength
            })
          },
          { type: "image", data: png.toString("base64"), mimeType: "image/png" }
        ],
        structuredContent: {
          asset_id: args.asset_id,
          revision: state.revision,
          mime_type: "image/png",
          bytes: png.byteLength
        }
      };
    }

    case "render_cutout_preview": {
      if(!args.cutout||args.cutout.version!==2)throw new Error("cutout preview requires version 2");
      if(!Number.isFinite(args.time_seconds)||args.time_seconds<0||
        typeof args.clip_id!=="string")throw new Error("invalid preview time or clip");
      const state=await store.load(args.asset_id);
      const compiled=compileCutout(state.document,args.cutout,{revision:state.revision});
      const frameData=await renderCutoutPreview({compiled,clipId:args.clip_id,timeSeconds:args.time_seconds});
      const latest=await store.load(args.asset_id);
      if(latest.revision!==state.revision)throw new Error("STALE_SOURCE_REVISION");
      const meta={
        asset_id:args.asset_id,revision:state.revision,source_sha256:compiled.sourceSha256,
        clip_id:args.clip_id,time_seconds:args.time_seconds,
        pose_ids:Object.fromEntries(Object.entries(frameData.frame.parts).map(([id,p])=>[id,p.poseId])),
        sha256:frameData.digest,bytes:frameData.png.length,mime_type:"image/png"
      };
      return {content:[{type:"text",text:JSON.stringify(meta)},
        {type:"image",data:frameData.png.toString("base64"),mimeType:"image/png"}],
        structuredContent:meta};
    }

    case "validate_asset": {
      const state = await store.load(args.asset_id);
      const result = validateDocument(state.document);
      return textResult({
        asset_id: args.asset_id,
        revision: state.revision,
        ...result
      });
    }

    case "export_asset": {
      const state = await store.load(args.asset_id);
      const validation = validateDocument(state.document);
      if (!validation.ok) throw new Error(validation.errors.join("; "));

      const outputDir = join(store.assetDir(args.asset_id), "output");
      await assertSafeLegacyExportOutput(outputDir);
      const svg = renderSvg(state.document);
      checkRenderBudget(svg);
      const svgPath = join(outputDir, "asset.svg");
      const pngPath = join(outputDir, "asset.png");
      const reportPath = join(outputDir, "report.json");
      await writeLegacyExportFile(svgPath, svg);
      const png = await renderPng(state.document);
      await writeLegacyExportFile(pngPath, png);
      const report = {
        asset_id: args.asset_id,
        revision: state.revision,
        node_count: state.document.nodes.length,
        validation
      };
      await writeLegacyExportFile(reportPath, JSON.stringify(report, null, 2) + "\n");
      return textResult({
        asset_id: args.asset_id,
        revision: state.revision,
        files: [
          `assets/${args.asset_id}/output/asset.svg`,
          `assets/${args.asset_id}/output/asset.png`,
          `assets/${args.asset_id}/output/report.json`
        ]
      });
    }

    case "export_godot_cutout": {
      const state = await store.load(args.asset_id);
      if(args.cutout?.version===2){
        const compiled=compileCutout(state.document,args.cutout,{revision:state.revision});
        const frames=await renderCutoutFrames(compiled,{});
        const atlas=packAtlas(frames,compiled.manifest.rendering);
        const animationReports=compiled.clipIds.map(clip=>auditLoop(compiled,clip));
        for(const report of animationReports)if(!report.ok)throw new Error("ANIMATION_QA_FAILED: "+report.errors.join('; '));
        const files=buildGodotV2Project(compiled,atlas,animationReports[0]);
        const pkg=await publishGodotPackage({store,assetId:args.asset_id,expectedRevision:state.revision,sourceSha256:compiled.sourceSha256,files});
        return textResult({
          asset_id:args.asset_id,revision:state.revision,version:2,
          parts:compiled.parts.length,animations:compiled.clipIds.length,
          source_sha256:compiled.sourceSha256,atlas_sha256:atlas.atlasSha256,
          package_sha256:pkg.packageSha256,
          project:`assets/${args.asset_id}/godot-versions/${pkg.packageSha256}`
        });
      }
      if(state.document.nodes.some(node=>node.appearance!==undefined))throw new Error("UNSUPPORTED_GODOT_APPEARANCE");
      const outputDir = join(store.assetDir(args.asset_id), "godot");
      await rm(outputDir, { recursive: true, force: true });
      await mkdir(outputDir, { recursive: true, mode: 0o700 });
      const result = await exportGodotCutout({
        document: state.document,
        cutout: args.cutout,
        outputDir
      });
      return textResult({
        asset_id: args.asset_id,
        revision: state.revision,
        parts: result.parts,
        animations: result.animations,
        project: `assets/${args.asset_id}/godot`
      });
    }

    case "style_profile_get": {
      const profile = await loadStyleProfile(args.profile_id);
      return textResult({ profile, version: profile.version });
    }

    case "style_validate": {
      const profile = await loadStyleProfile(args.profile_id);
      const state = await store.load(args.asset_id);
      const report = inspectStyle(state.document, profile);
      return textResult({
        asset_id: args.asset_id,
        revision: state.revision,
        ...report
      });
    }

    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function send(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.id === undefined) {
    return;
  }

  const id = message.id;

  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "game-artist-mcp", version: SERVER_VERSION }
      }
    });
    return;
  }

  if (message.method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }

  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools } });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      const result = await callTool(name, args);
      send({ jsonrpc: "2.0", id, result });
    } catch (error) {
      send({ jsonrpc: "2.0", id, result: errorResult(error) });
    }
    return;
  }

  send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found." } });
}

let buffer = "";
let chain = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  if(Buffer.byteLength(buffer,'utf8')>262144){
    buffer="";
    process.stderr.write("JSON-RPC input limit exceeded\\n");
    return;
  }
  for (;;) {
    const newline = buffer.indexOf("\n");
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    chain = chain.then(async () => {
      try {
        await handle(parseUniqueKeysJsonLine(line));
      } catch {
        // Reject malformed or ambiguous JSON without echoing untrusted content.
        send({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request" } });
      }
    });
  }
});
process.stdin.resume();
