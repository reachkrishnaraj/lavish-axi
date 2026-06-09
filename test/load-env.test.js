import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLavishEnv } from "../src/load-env.js";

test("loadLavishEnv applies vars from .env.lavish.local without overriding existing env", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-load-env-"));
  const envFile = path.join(dir, ".env.lavish.local");
  await writeFile(envFile, "LAVISH_AXI_STORE=mongodb://127.0.0.1:27017/testdb\nLAVISH_AXI_PORT=4999\n");

  const env = { LAVISH_AXI_PORT: "4387" };
  const loaded = loadLavishEnv({ cwd: dir, env });
  assert.equal(loaded, envFile);
  assert.equal(env.LAVISH_AXI_STORE, "mongodb://127.0.0.1:27017/testdb");
  assert.equal(env.LAVISH_AXI_PORT, "4387");
});
