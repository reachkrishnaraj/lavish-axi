import { MongoSessionStore } from "./mongo-session-store.js";
import { stateDir, stateFile, sqliteStateFile } from "./paths.js";
import { FileSessionStore } from "./session-store.js";
import { SqliteSessionStore } from "./sqlite-session-store.js";

function resolveFileStorePath(raw, fallbackFile) {
  if (!raw || raw === "file") {
    return fallbackFile;
  }
  if (raw.startsWith("file://")) {
    return raw.slice("file://".length);
  }
  if (raw.endsWith(".json")) {
    return raw;
  }
  return fallbackFile;
}

function mongoDbNameFromUrl(url, fallback = "lavish_axi") {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, "").trim();
    return name || fallback;
  } catch {
    return fallback;
  }
}

function resolveSqliteStorePath(raw, fallbackFile) {
  if (!raw || raw === "sqlite") {
    return fallbackFile;
  }
  if (raw.startsWith("sqlite://")) {
    return raw.slice("sqlite://".length);
  }
  if (raw.endsWith(".sqlite") || raw.endsWith(".db")) {
    return raw;
  }
  return fallbackFile;
}

export function resolveStoreConfig(env = process.env) {
  const raw = String(env.LAVISH_AXI_STORE || "file").trim();
  const lowered = raw.toLowerCase();

  if (/^mongodb(\+srv)?:\/\//i.test(raw)) {
    const dbOverride = String(env.LAVISH_AXI_STORE_DB || "").trim();
    return {
      type: "mongo",
      url: raw,
      dbName: dbOverride || mongoDbNameFromUrl(raw),
    };
  }

  if (lowered === "mongo" || lowered === "mongodb") {
    const url = String(env.MONGODB_URL || env.MONGODB_URI || "").trim();
    if (!/^mongodb(\+srv)?:\/\//i.test(url)) {
      throw new Error(
        "LAVISH_AXI_STORE=mongo requires MONGODB_URL or MONGODB_URI (mongodb://... or mongodb+srv://...)",
      );
    }
    const dbOverride = String(env.LAVISH_AXI_STORE_DB || "").trim();
    return {
      type: "mongo",
      url,
      dbName: dbOverride || mongoDbNameFromUrl(url),
    };
  }

  if (lowered === "sqlite" || lowered.startsWith("sqlite:") || lowered.endsWith(".sqlite") || lowered.endsWith(".db")) {
    return {
      type: "sqlite",
      file: resolveSqliteStorePath(raw, sqliteStateFile()),
    };
  }

  return {
    type: "file",
    file: resolveFileStorePath(raw, stateFile()),
  };
}

export async function createSessionStore({ stateFile: filePath, env = process.env } = {}) {
  if (filePath) {
    if (filePath.endsWith(".sqlite") || filePath.endsWith(".db")) {
      const store = new SqliteSessionStore(filePath);
      await store.connect();
      return store;
    }
    return new FileSessionStore(filePath);
  }

  const config = resolveStoreConfig(env);
  if (config.type === "mongo") {
    const store = new MongoSessionStore(config);
    await store.connect();
    return store;
  }
  if (config.type === "sqlite") {
    const store = new SqliteSessionStore(config.file);
    await store.connect();
    return store;
  }
  return new FileSessionStore(config.file);
}

export function describeStoreConfig(env = process.env) {
  const config = resolveStoreConfig(env);
  if (config.type === "mongo") {
    return { backend: "mongo", dbName: config.dbName };
  }
  if (config.type === "sqlite") {
    return { backend: "sqlite", file: config.file };
  }
  return { backend: "file", file: config.file };
}
