import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { renderSvg } from "../core/render-svg.mjs";
import { validateCutout } from "../cutout/validate.mjs";

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function gdString(value) {
  return JSON.stringify(String(value));
}

function partScenePath(partId, byId) {
  const segments = [];
  const guard = new Set();
  let cursor = byId.get(partId);
  while (cursor) {
    if (guard.has(cursor.id)) throw new Error("cutout hierarchy cycle at " + partId);
    guard.add(cursor.id);
    segments.unshift(cursor.id);
    cursor = cursor.parent ? byId.get(cursor.parent) : null;
  }
  return segments.join("/");
}

function partDepth(part, byId) {
  let value = 0;
  const guard = new Set();
  let cursor = part;
  while (cursor.parent) {
    if (guard.has(cursor.id)) throw new Error("cutout hierarchy cycle at " + part.id);
    guard.add(cursor.id);
    cursor = byId.get(cursor.parent);
    value += 1;
  }
  return value;
}

function parseHexColor(value) {
  const raw = String(value ?? "#ffffff").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return [1, 1, 1, 1];
  return [
    parseInt(raw.slice(0, 2), 16) / 255,
    parseInt(raw.slice(2, 4), 16) / 255,
    parseInt(raw.slice(4, 6), 16) / 255,
    1
  ];
}

function makeLightSvg(color) {
  const escaped = xmlEscape(color);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
    "  <defs>",
    '    <radialGradient id="g">',
    '      <stop offset="0" stop-color="' + escaped + '" stop-opacity="0.95"/>',
    '      <stop offset="0.45" stop-color="' + escaped + '" stop-opacity="0.38"/>',
    '      <stop offset="1" stop-color="' + escaped + '" stop-opacity="0"/>',
    "    </radialGradient>",
    "  </defs>",
    '  <rect width="64" height="64" fill="url(#g)"/>',
    "</svg>",
    ""
  ].join("\n");
}

function animationValue(property, value) {
  if (property === "position" || property === "scale") {
    return "Vector2(" + value[0] + ", " + value[1] + ")";
  }
  return String(value);
}

function makeAnimationResource(clip, byId) {
  const lines = [];
  const resourceId = "Animation_" + clip.id;
  lines.push('[sub_resource type="Animation" id="' + resourceId + '"]');
  lines.push("resource_name = " + gdString(clip.id));
  lines.push("length = " + clip.length);
  if (clip.loop) lines.push("loop_mode = 1");

  clip.tracks.forEach((track, index) => {
    const times = track.keys.map((key) => key.time).join(", ");
    const transitions = track.keys.map(() => "1").join(", ");
    const values = track.keys.map((key) => animationValue(track.property, key.value)).join(", ");
    const path = partScenePath(track.part, byId) + ":" + track.property;
    lines.push("tracks/" + index + '/type = "value"');
    lines.push("tracks/" + index + "/imported = false");
    lines.push("tracks/" + index + "/enabled = true");
    lines.push("tracks/" + index + "/path = NodePath(" + gdString(path) + ")");
    lines.push("tracks/" + index + "/interp = 1");
    lines.push("tracks/" + index + "/loop_wrap = true");
    lines.push("tracks/" + index + "/keys = {");
    lines.push('"times": PackedFloat32Array(' + times + "),");
    lines.push('"transitions": PackedFloat32Array(' + transitions + "),");
    lines.push('"update": 0,');
    lines.push('"values": [' + values + "]");
    lines.push("}");
  });
  return { resourceId, text: lines.join("\n") };
}

function makeValidationScript(cutout, byId) {
  const paths = cutout.parts.map((part) => partScenePath(part.id, byId));
  const lines = [
    "extends Node2D",
    "",
    "func _ready() -> void:",
    '    var lantern: Node = get_node("SpiritLantern")',
    "    var required_paths: Array[String] = ["
  ];
  for (const path of paths) lines.push("        " + gdString(path) + ",");
  lines.push(
    "    ]",
    "",
    "    for required_path: String in required_paths:",
    "        if lantern.get_node_or_null(NodePath(required_path)) == null:",
    '            push_error("Missing generated cutout part: " + required_path)',
    "            get_tree().quit(1)",
    "            return",
    "",
    '    var player: AnimationPlayer = lantern.get_node("AnimationPlayer") as AnimationPlayer',
    '    if player == null or not player.has_animation("idle"):',
    '        push_error("Generated lantern is missing idle animation")',
    "        get_tree().quit(1)",
    "        return",
    "",
    '    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:',
    '        push_error("Generated lantern is missing interaction collision")',
    "        get_tree().quit(1)",
    "        return",
    "",
    '    if lantern.get_node_or_null("body/flame/SpiritLight") == null:',
    '        push_error("Generated lantern is missing SpiritLight")',
    "        get_tree().quit(1)",
    "        return",
    "",
    '    print("GAME_ARTIST_POC004_OK")',
    "    get_tree().quit(0)",
    ""
  );
  return lines.join("\n");
}

export async function exportGodotCutout({ document, cutout, outputDir }) {
  if(cutout?.version!==1)throw new Error('Cutout v2 requires compiled atlas package; legacy exporter accepts v1 only');
  if(document?.nodes?.some(node=>node.appearance!==undefined))throw new Error('UNSUPPORTED_GODOT_APPEARANCE');
  const validation = validateCutout(document, cutout);
  if (!validation.ok) throw new Error("invalid cutout asset: " + validation.errors.join("; "));

  const byId = new Map(cutout.parts.map((part) => [part.id, part]));
  const enriched = {
    ...cutout,
    parts: cutout.parts.map((part) => ({
      ...part,
      scenePath: partScenePath(part.id, byId)
    }))
  };

  const projectDir = outputDir;
  const assetDir = join(projectDir, "assets", cutout.assetId);
  const partsDir = join(assetDir, "parts");
  await mkdir(partsDir, { recursive: true });

  for (const part of cutout.parts) {
    const selected = new Set(part.nodes);
    const partDocument = {
      ...document,
      nodes: document.nodes.filter((node) => selected.has(node.id))
    };
    await writeFile(join(partsDir, part.id + ".svg"), renderSvg(partDocument), "utf8");
  }

  await writeFile(join(assetDir, "asset.json"), JSON.stringify(enriched, null, 2) + "\n", "utf8");
  await writeFile(join(assetDir, "light.svg"), makeLightSvg(cutout.light?.color ?? "#72f5ec"), "utf8");

  const ext = [];
  const extIdByPart = new Map();
  let nextExt = 1;
  for (const part of cutout.parts) {
    const id = String(nextExt++);
    extIdByPart.set(part.id, id);
    ext.push('[ext_resource type="Texture2D" path="res://assets/' + cutout.assetId + "/parts/" + part.id + '.svg" id="' + id + "_" + part.id + '"]');
  }
  const lightId = String(nextExt++);
  ext.push('[ext_resource type="Texture2D" path="res://assets/' + cutout.assetId + '/light.svg" id="' + lightId + '_light"]');

  const animations = (cutout.animations ?? []).map((clip) => makeAnimationResource(clip, byId));
  const collisionSize = cutout.collision?.size ?? [64, 128];
  const loadSteps = 2 + ext.length + animations.length + 1;
  const scene = [];
  scene.push("[gd_scene load_steps=" + loadSteps + " format=3]");
  scene.push("");
  scene.push(...ext);

  for (const animation of animations) {
    scene.push("");
    scene.push(animation.text);
  }

  scene.push("");
  scene.push('[sub_resource type="AnimationLibrary" id="AnimationLibrary_main"]');
  scene.push("_data = {");
  animations.forEach((animation, index) => {
    const clip = cutout.animations[index];
    const comma = index === animations.length - 1 ? "" : ",";
    scene.push('&"' + clip.id + '": SubResource("' + animation.resourceId + '")' + comma);
  });
  scene.push("}");
  scene.push("");
  scene.push('[sub_resource type="RectangleShape2D" id="RectangleShape2D_collision"]');
  scene.push("size = Vector2(" + collisionSize[0] + ", " + collisionSize[1] + ")");

  scene.push("");
  scene.push('[node name="SpiritLantern" type="Node2D"]');

  const sorted = [...cutout.parts].sort((a, b) => partDepth(a, byId) - partDepth(b, byId));
  const center = [document.canvas.width / 2, document.canvas.height / 2];

  for (const part of sorted) {
    const parentPart = part.parent ? byId.get(part.parent) : null;
    const parentPath = part.parent ? partScenePath(part.parent, byId) : ".";
    const localX = part.pivot[0] - (parentPart?.pivot?.[0] ?? 0);
    const localY = part.pivot[1] - (parentPart?.pivot?.[1] ?? 0);
    const spriteX = center[0] - part.pivot[0];
    const spriteY = center[1] - part.pivot[1];
    scene.push("");
    scene.push('[node name="' + part.id + '" type="Node2D" parent="' + parentPath + '"]');
    scene.push("position = Vector2(" + localX + ", " + localY + ")");
    scene.push("z_index = " + (part.zIndex ?? 0));
    scene.push("");
    scene.push('[node name="Sprite2D" type="Sprite2D" parent="' + partScenePath(part.id, byId) + '"]');
    scene.push('texture = ExtResource("' + extIdByPart.get(part.id) + "_" + part.id + '")');
    scene.push("position = Vector2(" + spriteX + ", " + spriteY + ")");
  }

  if (cutout.light) {
    const lightPart = byId.get(cutout.light.part);
    const color = parseHexColor(cutout.light.color);
    const localX = cutout.light.position[0] - lightPart.pivot[0];
    const localY = cutout.light.position[1] - lightPart.pivot[1];
    scene.push("");
    scene.push('[node name="SpiritLight" type="PointLight2D" parent="' + partScenePath(cutout.light.part, byId) + '"]');
    scene.push("position = Vector2(" + localX + ", " + localY + ")");
    scene.push('texture = ExtResource("' + lightId + '_light")');
    scene.push("energy = " + cutout.light.energy);
    scene.push("texture_scale = " + cutout.light.textureScale);
    scene.push("color = Color(" + color.join(", ") + ")");
  }

  if (cutout.collision) {
    scene.push("");
    scene.push('[node name="Interaction" type="Area2D" parent="."]');
    scene.push("position = Vector2(" + cutout.collision.position[0] + ", " + cutout.collision.position[1] + ")");
    scene.push("");
    scene.push('[node name="CollisionShape2D" type="CollisionShape2D" parent="Interaction"]');
    scene.push('shape = SubResource("RectangleShape2D_collision")');
  }

  scene.push("");
  scene.push('[node name="AnimationPlayer" type="AnimationPlayer" parent="."]');
  scene.push("libraries = {");
  scene.push('&"": SubResource("AnimationLibrary_main")');
  scene.push("}");
  if (animations.length > 0) scene.push("autoplay = " + gdString(cutout.animations[0].id));

  await writeFile(join(assetDir, "spirit_lantern.tscn"), scene.join("\n") + "\n", "utf8");

  const project = [
    "config_version=5",
    "",
    "[application]",
    'config/name="Game Artist POC-004"',
    'run/main_scene="res://main.tscn"',
    "",
    "[display]",
    "window/size/viewport_width=512",
    "window/size/viewport_height=512",
    "",
    "[rendering]",
    'renderer/rendering_method="gl_compatibility"',
    'renderer/rendering_method.mobile="gl_compatibility"',
    ""
  ].join("\n");
  await writeFile(join(projectDir, "project.godot"), project, "utf8");

  await writeFile(join(projectDir, "validation.gd"), makeValidationScript(cutout, byId), "utf8");
  const mainScene = [
    "[gd_scene load_steps=3 format=3]",
    "",
    '[ext_resource type="PackedScene" path="res://assets/' + cutout.assetId + '/spirit_lantern.tscn" id="1_lantern"]',
    '[ext_resource type="Script" path="res://validation.gd" id="2_validation"]',
    "",
    '[node name="Validation" type="Node2D"]',
    'script = ExtResource("2_validation")',
    "",
    '[node name="SpiritLantern" parent="." instance=ExtResource("1_lantern")]',
    ""
  ].join("\n");
  await writeFile(join(projectDir, "main.tscn"), mainScene, "utf8");

  return {
    assetId: cutout.assetId,
    parts: cutout.parts.length,
    animations: cutout.animations?.length ?? 0,
    projectDir,
    validation
  };
}
