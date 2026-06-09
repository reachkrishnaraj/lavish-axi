import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function parseEnvFile(content) {
  const entries = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function walkUpForEnvFile(startDir, filename) {
  const found = [];
  let dir = path.resolve(startDir);
  for (;;) {
    found.push(path.join(dir, filename));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

export function resolveLavishEnvFiles({ cwd = process.cwd(), env = process.env } = {}) {
  const files = [];
  if (env.LAVISH_AXI_ENV_FILE) {
    files.push(path.resolve(cwd, env.LAVISH_AXI_ENV_FILE));
  }
  files.push(...walkUpForEnvFile(cwd, ".env.lavish.local"));
  files.push(path.join(env.LAVISH_AXI_STATE_DIR || path.join(os.homedir(), ".lavish-axi"), "env.local"));
  return files;
}

/** Load the first matching Lavish env file into process.env (does not override existing vars). */
export function loadLavishEnv({ cwd = process.cwd(), env = process.env } = {}) {
  for (const file of resolveLavishEnvFiles({ cwd, env })) {
    if (!existsSync(file)) continue;
    const parsed = parseEnvFile(readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] == null || env[key] === "") {
        env[key] = value;
      }
    }
    return file;
  }
  return null;
}
