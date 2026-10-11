#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
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
  // O_NOFOLLOW rejects symlink substitutions of the destination after preflight.
  const handle = await open(path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); }
  finally { await handle.close(); }
}

const tools = [
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
