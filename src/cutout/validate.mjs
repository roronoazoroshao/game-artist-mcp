import {validateCutoutV2} from './validate-v2.mjs';

const ID = /^[a-z][a-z0-9_]{0,63}$/;
const TRACK_PROPERTIES = new Set(["rotation", "position", "scale"]);

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function vec2(value) {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
}

export function validateCutout(document, cutout) {
  if(cutout?.version===2)return validateCutoutV2(document,cutout);
  const errors = [];
  const warnings = [];

  if (!document || !Array.isArray(document.nodes) || !document.canvas) {
    errors.push("document must contain canvas and nodes");
    return { ok: false, errors, warnings };
  }
  if (!cutout || cutout.version !== 1) {
    errors.push("cutout.version must be 1");
    return { ok: false, errors, warnings };
  }
  if (typeof cutout.assetId !== "string" || !ID.test(cutout.assetId)) {
    errors.push("cutout.assetId must be a safe snake_case id");
  }
  if (!Array.isArray(cutout.parts) || cutout.parts.length === 0) {
    errors.push("cutout.parts must be a non-empty array");
    return { ok: false, errors, warnings };
  }
  if (cutout.parts.length > 64) errors.push("cutout part limit is 64");

  const documentNodes = new Set(document.nodes.map((node) => node.id));
  const partIds = new Set();
  const nodeOwners = new Map();

  for (const part of cutout.parts) {
    if (!part || typeof part.id !== "string" || !ID.test(part.id)) {
      errors.push("every part requires a safe snake_case id");
      continue;
    }
    if (partIds.has(part.id)) errors.push("duplicate part id: " + part.id);
    partIds.add(part.id);

    if (!Array.isArray(part.nodes) || part.nodes.length === 0) {
      errors.push("part " + part.id + " requires at least one document node");
    } else if (part.nodes.length > 64) {
      errors.push("part " + part.id + " exceeds the 64-node limit");
    } else {
      for (const nodeId of part.nodes) {
        if (!documentNodes.has(nodeId)) errors.push("part " + part.id + " references unknown node: " + nodeId);
        const owner = nodeOwners.get(nodeId);
        if (owner && owner !== part.id) errors.push("document node " + nodeId + " belongs to multiple parts");
        nodeOwners.set(nodeId, part.id);
      }
    }

    if (!vec2(part.pivot)) errors.push("part " + part.id + " requires finite pivot [x,y]");
    if (part.parent !== null && part.parent !== undefined && typeof part.parent !== "string") {
      errors.push("part " + part.id + " parent must be null or a part id");
    }
    if (!Number.isInteger(part.zIndex ?? 0)) errors.push("part " + part.id + " zIndex must be an integer");
  }

  const byId = new Map(cutout.parts.map((part) => [part.id, part]));
  for (const part of cutout.parts) {
    if (!part?.id) continue;
    if (part.parent && !byId.has(part.parent)) errors.push("part " + part.id + " has unknown parent: " + part.parent);
    if (part.parent === part.id) errors.push("part " + part.id + " cannot parent itself");

    const seen = new Set([part.id]);
    let cursor = part.parent ? byId.get(part.parent) : null;
    while (cursor) {
      if (seen.has(cursor.id)) {
        errors.push("part hierarchy cycle detected at " + part.id);
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parent ? byId.get(cursor.parent) : null;
    }
  }

  const animations = cutout.animations ?? [];
  if (!Array.isArray(animations)) {
    errors.push("animations must be an array");
  } else {
    const clipIds = new Set();
    for (const clip of animations) {
      if (!clip || typeof clip.id !== "string" || !ID.test(clip.id)) {
        errors.push("animation clip requires a safe id");
        continue;
      }
      if (clipIds.has(clip.id)) errors.push("duplicate animation id: " + clip.id);
      clipIds.add(clip.id);
      if (!finite(clip.length) || clip.length <= 0 || clip.length > 60) {
        errors.push("animation " + clip.id + " length must be >0 and <=60 seconds");
      }
      if (!Array.isArray(clip.tracks) || clip.tracks.length === 0) {
        errors.push("animation " + clip.id + " requires tracks");
        continue;
      }
      if (clip.tracks.length > 128) errors.push("animation " + clip.id + " exceeds track limit");

      for (const track of clip.tracks) {
        if (!byId.has(track.part)) errors.push("animation " + clip.id + " references unknown part: " + track.part);
        if (!TRACK_PROPERTIES.has(track.property)) errors.push("animation " + clip.id + " has unsupported property: " + track.property);
        if (!Array.isArray(track.keys) || track.keys.length < 2 || track.keys.length > 64) {
          errors.push("animation " + clip.id + " track " + track.part + " requires 2-64 keys");
          continue;
        }
        let previous = -Infinity;
        for (const key of track.keys) {
          if (!finite(key.time) || key.time < 0 || key.time > clip.length || key.time < previous) {
            errors.push("animation " + clip.id + " track " + track.part + " has invalid key time");
          }
          previous = key.time;
          if (track.property === "rotation" && !finite(key.value)) {
            errors.push("animation " + clip.id + " rotation keys must be finite numbers");
          }
          if ((track.property === "position" || track.property === "scale") && !vec2(key.value)) {
            errors.push("animation " + clip.id + " " + track.property + " keys must be [x,y]");
          }
        }
      }
    }
  }

  if (cutout.light) {
    if (!byId.has(cutout.light.part)) errors.push("light.part must reference a known part");
    if (!vec2(cutout.light.position)) errors.push("light.position must be [x,y]");
    if (!finite(cutout.light.energy) || cutout.light.energy < 0 || cutout.light.energy > 16) {
      errors.push("light.energy must be between 0 and 16");
    }
    if (!finite(cutout.light.textureScale) || cutout.light.textureScale <= 0 || cutout.light.textureScale > 16) {
      errors.push("light.textureScale must be >0 and <=16");
    }
  }

  if (cutout.collision) {
    if (!vec2(cutout.collision.position)) errors.push("collision.position must be [x,y]");
    if (!vec2(cutout.collision.size) || cutout.collision.size.some((value) => value <= 0)) {
      errors.push("collision.size must contain positive width/height");
    }
  }

  const unowned = [...documentNodes].filter((id) => !nodeOwners.has(id));
  if (unowned.length > 0) warnings.push(unowned.length + " document nodes are not assigned to a cutout part");

  return { ok: errors.length === 0, errors, warnings };
}
