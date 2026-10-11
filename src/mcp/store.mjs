import { mkdir, readFile, rename, writeFile, lstat, rmdir } from "node:fs/promises";
import { resolve, join } from "node:path";

import { createAssetState } from "../core/engine.mjs";
import { validateDocument } from "../core/validate.mjs";

const ASSET_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function assertAssetId(assetId) {
  if (typeof assetId !== "string" || !ASSET_ID.test(assetId)) {
    throw new Error("asset_id must match ^[a-z0-9][a-z0-9_-]{0,63}$");
  }
  return assetId;
}

async function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await rename(tmp, path);
}

export class AssetStore {
  constructor(root) {
    this.root = resolve(root);
  }

  async init() {
    await mkdir(join(this.root, "assets"), { recursive: true, mode: 0o700 });
  }

  assetDir(assetId) {
    assertAssetId(assetId);
    return join(this.root, "assets", assetId);
  }

  statePath(assetId) {
    return join(this.assetDir(assetId), "state.json");
  }

  // Shared between all AssetStore processes using the same local filesystem.
  // A crashed writer intentionally leaves the lock behind (fail closed):
  // recovery requires verifying no process is using this asset first.
  async withAssetWriteLock(assetId, operation) {
    assertAssetId(assetId);
    if (typeof operation !== "function") throw new Error("invalid locked operation");
    const dir = this.assetDir(assetId);
    for (const path of [this.root, join(this.root, "assets"), dir]) {
      const st = await lstat(path);
      if (!st.isDirectory() || st.isSymbolicLink()) {
        throw new Error("unsafe symlink or asset directory: " + path);
      }
    }
    const lockPath = join(dir, ".asset-write-lock");
    try {
      await mkdir(lockPath, {mode: 0o700});
    } catch (error) {
      if (error?.code === "EEXIST") throw new Error("ASSET_BUSY");
      throw error;
    }
    try {
      return await operation();
    } finally {
      // Do not silently remove somebody else's lock after a filesystem anomaly.
      await rmdir(lockPath);
    }
  }

  async create(assetId, width, height) {
    assertAssetId(assetId);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("width and height must be positive finite numbers");
    }
    if (width > 4096 || height > 4096) {
      throw new Error("POC canvas limit is 4096x4096");
    }

    await this.init();
    const dir = this.assetDir(assetId);
    await mkdir(dir, { recursive: false, mode: 0o700 }).catch((error) => {
      if (error?.code === "EEXIST") throw new Error(`asset already exists: ${assetId}`);
      throw error;
    });

    const state = createAssetState({
      version: 1,
      canvas: { width, height, background: "transparent" },
      nodes: []
    });

    await writeJsonAtomic(this.statePath(assetId), state);
    return clone(state);
  }

  async load(assetId) {
    assertAssetId(assetId);
    let text;
    try {
      text = await readFile(this.statePath(assetId), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error(`asset not found: ${assetId}`);
      throw error;
    }

    const state = JSON.parse(text);
    const validation = validateDocument(state.document);
    if (!validation.ok) {
      throw new Error(`stored asset is invalid: ${validation.errors.join("; ")}`);
    }
    if (!Number.isInteger(state.revision) || state.revision < 0 || !Array.isArray(state.history)) {
      throw new Error("stored asset state metadata is invalid");
    }
    return state;
  }

  async save(assetId, state) {
    assertAssetId(assetId);
    const validation = validateDocument(state.document);
    if (!validation.ok) throw new Error(validation.errors.join("; "));
    if (!Number.isSafeInteger(state.revision) || !Array.isArray(state.history)) {
      throw new Error("invalid asset state revision or history");
    }
    return this.withAssetWriteLock(assetId, async () => {
      const latest = await this.load(assetId);
      if (state.revision !== latest.revision + 1) {
        throw new Error(`revision conflict: expected next ${latest.revision + 1}, got ${state.revision}`);
      }
      await writeJsonAtomic(this.statePath(assetId), state);
      return clone(state);
    });
  }
}
