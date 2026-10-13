import { mkdir, rename, lstat, rmdir, open, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, join, dirname } from "node:path";

import { createAssetState } from "../core/engine.mjs";
import { validateDocument } from "../core/validate.mjs";

const ASSET_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_STATE_BYTES = 16 * 1024 * 1024;

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
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
  if (bytes.length > MAX_STATE_BYTES) throw new Error("STATE_SIZE_LIMIT");
  // Randomized, exclusive creation defeats planted PID-named symlinks.
  // Sync the file and containing directory before reporting a committed state.
  const tmp = `${path}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`;
  try {
    const handle = await open(tmp, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, path);
    const parent = await open(dirname(path), "r");
    try { await parent.sync(); } finally { await parent.close(); }
  } finally {
    await rm(tmp, {force: true});
  }
}

export class AssetStore {
  constructor(root) {
    this.root = resolve(root);
  }

  async init() {
    // Refuse existing symlinks before creating any asset beneath the root.
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const rootInfo = await lstat(this.root);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
      throw new Error("unsafe symlink or workspace directory");
    }
    const assetsPath = join(this.root, "assets");
    try {
      await mkdir(assetsPath, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const assetsInfo = await lstat(assetsPath);
    if (!assetsInfo.isDirectory() || assetsInfo.isSymbolicLink()) {
      throw new Error("unsafe symlink or assets directory");
    }
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
      for (const path of [this.root, join(this.root, "assets"), this.assetDir(assetId)]) {
        const directory = await lstat(path);
        if (!directory.isDirectory() || directory.isSymbolicLink()) {
          throw new Error("unsafe symlink or asset directory: " + path);
        }
      }
      const statePath = this.statePath(assetId);
      const entry = await lstat(statePath);
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error("unsafe state file symlink");
      }
      const handle = await open(statePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new Error("STATE_SIZE_LIMIT");
        // Bounded reads protect against growth after stat() as well.
        const parts = [];
        const chunk = Buffer.allocUnsafe(64 * 1024);
        let used = 0;
        for (;;) {
          const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
          if (bytesRead === 0) break;
          used += bytesRead;
          if (used > MAX_STATE_BYTES) throw new Error("STATE_SIZE_LIMIT");
          parts.push(Buffer.from(chunk.subarray(0, bytesRead)));
        }
        text = Buffer.concat(parts, used).toString("utf8");
      } finally { await handle.close(); }
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error(`asset not found: ${assetId}`);
      if (error?.code === "ELOOP") throw new Error("unsafe state file symlink");
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
