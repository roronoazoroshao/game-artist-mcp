import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const workspace = await mkdtemp(join(tmpdir(), "game-artist-mcp-smoke-"));
const child = spawn(
  process.execPath,
  [join(root, "src/mcp/server.mjs"), "--workspace", workspace],
  { stdio: ["pipe", "pipe", "pipe"] }
);

let buffer = "";
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf("\n");
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      entry.resolve(message);
    }
  }
});

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

function call(id, method, params = undefined) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for MCP response ${id}; stderr=${stderr}`));
    }, process.env.GAME_ARTIST_RUN_REAL_GODOT==="1" ? 40000 : 10000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolvePromise(value);
      }
    });
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params })
    }) + "\n");
  });
}

try {
  const init = await call(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "game-artist-smoke", version: "1.0.0" }
  });
  assert.equal(init.result.serverInfo.name, "game-artist-mcp");

  const listed = await call(2, "tools/list");
  const names = listed.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "artist_session_begin",
    "artist_session_observe",
    "artist_session_reinspect",
    "artist_session_decide",
    "artist_session_status",
    "paint_scene_observe",
    "paint_scene_compare",
    "paint_import_png",
    "paint_diff_preview",
    "paint_evaluate",
    "paint_open",
    "paint_apply",
    "paint_preview",
    "paint_compare",
    "paint_restore",
    "paint_export",
    "health",
    "asset_create",
    "asset_get",
    "document_query",
    "document_apply_ops",
    "render_preview",
    "render_cutout_preview",
    "validate_asset",
    "export_asset",
    "export_godot_cutout",
    "style_profile_get",
    "style_validate"
  ]);

  const health = await call(3, "tools/call", { name: "health", arguments: {} });
  assert.equal(health.result.isError, undefined);

  const created = await call(4, "tools/call", {
    name: "asset_create",
    arguments: { asset_id: "smoke_stone", width: 128, height: 128 }
  });
  assert.equal(created.result.isError, undefined);

  const edited = await call(5, "tools/call", {
    name: "document_apply_ops",
    arguments: {
      asset_id: "smoke_stone",
      expected_revision: 0,
      idempotency_key: "smoke-construct-1",
      operations: [
        {
          type: "node.add",
          node: {
            id: "outer",
            type: "polygon",
            points: [[64, 8], [108, 64], [64, 120], [20, 64]],
            fill: "#5f9f80",
            stroke: "#18231f",
            strokeWidth: 7
          }
        },
        {
          type: "node.add",
          node: {
            id: "core",
            type: "ellipse",
            cx: 64,
            cy: 62,
            rx: 17,
            ry: 25,
            fill: "#b9ffe2",
            stroke: "#eafff6",
            strokeWidth: 3
          }
        }
      ]
    }
  });
  assert.equal(edited.result.isError, undefined);

  const stale = await call(6, "tools/call", {
    name: "document_apply_ops",
    arguments: {
      asset_id: "smoke_stone",
      expected_revision: 0,
      operations: [{ type: "node.remove", id: "core" }]
    }
  });
  assert.equal(stale.result.isError, true);
  assert.match(stale.result.content[0].text, /revision conflict/);

  const preview = await call(7, "tools/call", {
    name: "render_preview",
    arguments: { asset_id: "smoke_stone" }
  });
  assert.equal(preview.result.isError, undefined);
  const image = preview.result.content.find((block) => block.type === "image");
  assert.ok(image);
  const bytes = Buffer.from(image.data, "base64");
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const validation = await call(8, "tools/call", {
    name: "validate_asset",
    arguments: { asset_id: "smoke_stone" }
  });
  assert.equal(validation.result.isError, undefined);

  const exported = await call(9, "tools/call", {
    name: "export_asset",
    arguments: { asset_id: "smoke_stone" }
  });
  assert.equal(exported.result.isError, undefined);

  for (const name of ["asset.svg", "asset.png", "report.json"]) {
    const file = join(workspace, "assets", "smoke_stone", "output", name);
    assert.ok((await stat(file)).size > 0, `${name} should be non-empty`);
  }

  const state = JSON.parse(
    await readFile(join(workspace, "assets", "smoke_stone", "state.json"), "utf8")
  );
  assert.equal(state.revision, 1);
  assert.equal(state.document.nodes.length, 2);

  const profileGet = await call(10, "tools/call", {
    name: "style_profile_get",
    arguments: { profile_id: "dark-cultivation-v1" }
  });
  assert.equal(profileGet.result.isError, undefined);
  const profile = JSON.parse(profileGet.result.content[0].text);
  assert.equal(profile.profile.id, "dark-cultivation-v1");
  assert.equal(profile.version, 1);

  const styleCheck = await call(11, "tools/call", {
    name: "style_validate",
    arguments: { asset_id: "smoke_stone", profile_id: "dark-cultivation-v1" }
  });
  assert.equal(styleCheck.result.isError, undefined);
  const checked = JSON.parse(styleCheck.result.content[0].text);
  assert.equal(checked.revision, 1);
  assert.equal(checked.ok, false); // existing smoke colors deliberately differ


  const styleAsset = await call(14, "tools/call", {
    name: "asset_create", arguments: { asset_id: "style_smoke", width: 64, height: 64 }
  });
  assert.equal(styleAsset.result.isError, undefined);
  const styledEdit = await call(15, "tools/call", {
    name: "document_apply_ops",
    arguments: { asset_id: "style_smoke", expected_revision: 0,
      operations: [{ type: "node.add", node: { id: "styled", type: "ellipse",
        cx: 32, cy: 32, rx: 10, ry: 16,
        fill: profile.profile.palette.allowedHex[0], stroke: profile.profile.palette.allowedHex[1],
        strokeWidth: profile.profile.stroke.allowedWidths[0] } }]
    }
  });
  assert.equal(styledEdit.result.isError, undefined);
  const styledCheck = await call(16, "tools/call", {
    name: "style_validate", arguments: { asset_id: "style_smoke", profile_id: "dark-cultivation-v1" }
  });
  assert.equal(styledCheck.result.isError, undefined);
  const styledReport = JSON.parse(styledCheck.result.content[0].text);
  assert.equal(styledReport.revision, 1);
  assert.equal(styledReport.ok, true, JSON.stringify(styledReport));
  const styleReadback = await call(17, "tools/call", {
    name: "asset_get", arguments: { asset_id: "style_smoke" }
  });
  assert.equal(JSON.parse(styleReadback.result.content[0].text).revision, 1);

  const missingProfile = await call(12, "tools/call", {
    name: "style_profile_get", arguments: { profile_id: "../secret" }
  });
  assert.equal(missingProfile.result.isError, true);
  assert.match(missingProfile.result.content[0].text, /unknown style profile/);

  const missingAsset = await call(13, "tools/call", {
    name: "style_validate", arguments: { asset_id: "missing", profile_id: "dark-cultivation-v1" }
  });
  assert.equal(missingAsset.result.isError, true);

  const stateAfterStyle = JSON.parse(
    await readFile(join(workspace, "assets", "smoke_stone", "state.json"), "utf8")
  );
  assert.deepEqual(stateAfterStyle, state);

  // Real MCP creation -> brush edit -> PNG observation -> comparison -> rollback -> Godot.
  const paintInit=await call(30,"tools/call",{name:"paint_open",arguments:{asset_id:"smoke_stone"}});
  assert.equal(paintInit.result.isError,undefined);
  const paint=await call(31,"tools/call",{name:"paint_apply",arguments:{
    asset_id:"smoke_stone",expected_revision:0,operations:[
      {type:"layer.create",layerId:"spirit"},
      {type:"stroke.draw",layerId:"spirit",color:"#33ddcc",radius:9,opacity:1,
        points:[[35,42,1],[91,42,.7]]}
    ]
  }});
  assert.equal(paint.result.isError,undefined,JSON.stringify(paint));
  const paintImage=await call(32,"tools/call",{name:"paint_preview",arguments:{asset_id:"smoke_stone",size:64}});
  assert.equal(paintImage.result.isError,undefined);
  const painted=paintImage.result.content.find(x=>x.type==="image");
  assert.ok(painted&&Buffer.from(painted.data,"base64").length>100);
  const comparison=await call(33,"tools/call",{name:"paint_compare",arguments:{
    asset_id:"smoke_stone",baseline_revision:0,candidate_revision:1,size:64}});
  assert.ok(JSON.parse(comparison.result.content[0].text).changedPixels>0);
  const exportedPaint=await call(34,"tools/call",{name:"paint_export",arguments:{asset_id:"smoke_stone",expected_revision:1}});
  assert.equal(exportedPaint.result.isError,undefined,JSON.stringify(exportedPaint));
  const exportResult=JSON.parse(exportedPaint.result.content[0].text);
  for(const f of ["art.png","main.tscn","project.godot"]){
    assert.ok((await stat(join(workspace,exportResult.project,f))).size>0);
  }
  const reverted=await call(35,"tools/call",{name:"paint_restore",arguments:{asset_id:"smoke_stone",expected_revision:1,target_revision:0}});
  assert.equal(reverted.result.isError,undefined);
  const afterRestore=await call(36,"tools/call",{name:"paint_compare",arguments:{
    asset_id:"smoke_stone",baseline_revision:0,candidate_revision:2}});
  assert.equal(JSON.parse(afterRestore.result.content[0].text).changedPixels,0);
  const incoming=await call(38,"tools/call",{name:"paint_import_png",arguments:{
    asset_id:"smoke_stone",expected_revision:2,layer_id:"reference",
    image_base64:Buffer.from(image.data,"base64").toString("base64"),source_label:"local-generated-vector"
  }});
  assert.equal(incoming.result.isError,undefined,JSON.stringify(incoming).slice(0,1500));
  const diffResult=await call(39,"tools/call",{name:"paint_diff_preview",arguments:{
    asset_id:"smoke_stone",baseline_revision:2,candidate_revision:3,size:64
  }});
  assert.equal(diffResult.result.isError,undefined);
  assert.ok(diffResult.result.content.find(x=>x.type==="image"));
  assert.ok(JSON.parse(diffResult.result.content[0].text).changedPixels>0);
  const evaluated=await call(40,"tools/call",{name:"paint_evaluate",arguments:{
    asset_id:"smoke_stone",baseline_revision:2,candidate_revision:3,
    min_coverage:0.001,max_coverage:1,min_changed_pixels:1,max_iterations:3
  }});
  assert.equal(evaluated.result.isError,undefined);
  assert.equal(JSON.parse(evaluated.result.content[0].text).result,"OBJECTIVE_TARGET_MET");
  assert.equal(JSON.parse(evaluated.result.content[0].text).artisticReview,"UNSCORED");
  if(process.env.GAME_ARTIST_RUN_REAL_GODOT==="1"){
    const shot=await call(45,"tools/call",{name:"paint_scene_observe",arguments:{
      asset_id:"smoke_stone",revision:3,size:128,environment:"twilight"
    }});
    assert.equal(shot.result.isError,undefined,JSON.stringify(shot).slice(0,550));
    assert.ok(shot.result.content.find(c=>c.type==="image"),"must expose actual Godot PNG");
    assert.equal(JSON.parse(shot.result.content[0].text).engine,"REAL_GODOT_FRAMEBUFFER");
    const measured=await call(46,"tools/call",{name:"paint_scene_compare",arguments:{
      asset_id:"smoke_stone",baseline_revision:2,candidate_revision:3,size:64,environment:"moonlight"
    }});
    assert.equal(measured.result.isError,undefined,JSON.stringify(measured).slice(0,600));
    assert.equal(JSON.parse(measured.result.content[0].text).source,"GODOT_REAL_FRAMEBUFFER");
    assert.ok(JSON.parse(measured.result.content[0].text).changedPixels>0);
  }
  if(process.env.GAME_ARTIST_RUN_REAL_GODOT==="1"){
    // A protocol smoke driver, NOT an actual aesthetic AI assessor. Critique is
    // prewritten and always marked UNSCORED; test only transport/state/rollback.
    const sessionStart=await call(50,"tools/call",{name:"artist_session_begin",arguments:{
      asset_id:"smoke_stone",brief:"Enhance the legibility of spirit light",max_iterations:1,
      size:64,environment:"twilight"
    }});
    assert.equal(sessionStart.result.isError,undefined,JSON.stringify(sessionStart).slice(0,500));
    const sessionShot=await call(51,"tools/call",{name:"artist_session_observe",arguments:{
      asset_id:"smoke_stone",expected_version:0
    }});
    assert.equal(sessionShot.result.isError,undefined,JSON.stringify(sessionShot).slice(0,500));
    assert.ok(sessionShot.result.content.some(x=>x.type==="image"));
    const sha=JSON.parse(sessionShot.result.content[0].text).observationSha256;
    const redisplayed=await call(56,"tools/call",{name:"artist_session_reinspect",arguments:{
      asset_id:"smoke_stone",expected_version:1
    }});
    assert.equal(redisplayed.result.isError,undefined,JSON.stringify(redisplayed).slice(0,500));
    assert.equal(JSON.parse(redisplayed.result.content[0].text).observationSha256,sha);
    assert.equal(redisplayed.result.content.find(x=>x.type==="image")?.data,
      sessionShot.result.content.find(x=>x.type==="image")?.data);
    assert.equal(JSON.parse(redisplayed.result.content[0].text).evidenceMode,
      "EXACT_STORED_GODOT_PNG_NO_RECAPTURE");
    const chosen=await call(52,"tools/call",{name:"artist_session_decide",arguments:{
      asset_id:"smoke_stone",expected_version:1,observation_sha256:sha,decision:"REVISE",
      critique:"Protocol fixture needs a lighter secondary edge on the lantern",
      operations:[{type:"stroke.draw",layerId:"reference",color:"#bdeeff",radius:3,opacity:.5,
       points:[[16,16,1],[36,36,.5]]}]
    }});
    assert.equal(chosen.result.isError,undefined,JSON.stringify(chosen).slice(0,500));
    assert.equal(JSON.parse(chosen.result.content[0].text).iteration,1);
    const more=await call(53,"tools/call",{name:"artist_session_observe",arguments:{
      asset_id:"smoke_stone",expected_version:2
    }});
    assert.equal(more.result.isError,undefined,JSON.stringify(more).slice(0,500));
    const finalSha=JSON.parse(more.result.content[0].text).observationSha256;
    const done=await call(54,"tools/call",{name:"artist_session_decide",arguments:{
      asset_id:"smoke_stone",expected_version:3,observation_sha256:finalSha,decision:"FINISH",
      critique:"Ready for external art examination, no aesthetic approval declared"
    }});
    assert.equal(done.result.isError,undefined,JSON.stringify(done).slice(0,500));
    assert.equal(JSON.parse(done.result.content[0].text).phase,"REVIEW_PENDING");
    const status=await call(55,"tools/call",{name:"artist_session_status",arguments:{asset_id:"smoke_stone"}});
    assert.equal(status.result.isError,undefined);
    assert.equal(JSON.parse(status.result.content[0].text).exportAllowed,false);
  }
  const unchangedVector=JSON.parse((await call(37,"tools/call",{
    name:"asset_get",arguments:{asset_id:"smoke_stone"}})).result.content[0].text);
  assert.equal(unchangedVector.revision,state.revision);
  assert.deepEqual(unchangedVector.document,state.document);
  assert.deepEqual(JSON.parse(await readFile(join(workspace,"assets","smoke_stone","state.json"),"utf8")),state);
  console.log(JSON.stringify({
    ok: true,
    tools: names.length,
    finalRevision: state.revision,
    pngBytes: bytes.byteLength
  }, null, 2));
} finally {
  child.kill("SIGTERM");
  await rm(workspace, { recursive: true, force: true });
}
