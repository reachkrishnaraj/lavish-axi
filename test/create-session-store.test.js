import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createSessionStore, resolveStoreConfig } from "../src/create-session-store.js";
import { FileSessionStore } from "../src/session-store.js";
import { SqliteSessionStore } from "../src/sqlite-session-store.js";

test("resolveStoreConfig defaults to file backend", () => {
  const config = resolveStoreConfig({ LAVISH_AXI_STORE: "", HOME: "/tmp" });
  assert.equal(config.type, "file");
  assert.match(config.file, /state\.json$/);
});

test("resolveStoreConfig selects sqlite backend", () => {
  const config = resolveStoreConfig({ LAVISH_AXI_STORE: "sqlite", HOME: "/tmp" });
  assert.equal(config.type, "sqlite");
  assert.match(config.file, /state\.sqlite$/);
});

test("resolveStoreConfig selects mongo backend from URL", () => {
  const config = resolveStoreConfig({
    LAVISH_AXI_STORE: "mongodb://127.0.0.1:27017/confluence",
  });
  assert.equal(config.type, "mongo");
  assert.equal(config.dbName, "confluence");
});

test("resolveStoreConfig honors LAVISH_AXI_STORE_DB override", () => {
  const config = resolveStoreConfig({
    LAVISH_AXI_STORE: "mongodb://127.0.0.1:27017/confluence",
    LAVISH_AXI_STORE_DB: "lavish_axi",
  });
  assert.equal(config.dbName, "lavish_axi");
});

test("createSessionStore returns FileSessionStore by default", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-create-store-"));
  try {
    const store = await createSessionStore({
      stateFile: path.join(dir, "state.json"),
      env: { LAVISH_AXI_STORE: "file" },
    });
    assert.equal(store.backend, "file");
    assert.ok(store instanceof FileSessionStore);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("createSessionStore returns SqliteSessionStore when configured", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-create-store-"));
  try {
    const store = await createSessionStore({
      env: { LAVISH_AXI_STORE: `sqlite://${path.join(dir, "custom.sqlite")}` },
    });
    assert.equal(store.backend, "sqlite");
    assert.ok(store instanceof SqliteSessionStore);
    await store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
