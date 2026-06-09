import path from "node:path";
import test from "node:test";

import { SqliteSessionStore } from "../src/sqlite-session-store.js";
import { runSessionStoreContract } from "./session-store-contract.js";

test("SqliteSessionStore satisfies the shared session contract", async () => {
  await runSessionStoreContract("sqlite", async (dir) => {
    const store = new SqliteSessionStore(path.join(dir, "state.sqlite"));
    await store.connect();
    return store;
  });
});
