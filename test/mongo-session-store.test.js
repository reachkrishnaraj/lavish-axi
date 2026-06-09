import test from "node:test";

import { MongoSessionStore } from "../src/mongo-session-store.js";
import { runSessionStoreContract } from "./session-store-contract.js";

const mongoUrl = String(process.env.LAVISH_AXI_MONGO_TEST_URL || process.env.MONGODB_URL || "").trim();
const shouldRun = /^mongodb(\+srv)?:\/\//i.test(mongoUrl);

test(
  "MongoSessionStore satisfies the shared session contract",
  { skip: shouldRun ? false : "set LAVISH_AXI_MONGO_TEST_URL or MONGODB_URL to run mongo store tests" },
  async () => {
    const store = new MongoSessionStore({
      url: mongoUrl,
      dbName: `lavish_axi_test_${Date.now()}`,
    });
    await store.connect();
    try {
      await runSessionStoreContract("mongo", async () => store);
    } finally {
      if (store.collection) {
        await store.collection.drop().catch(() => {});
      }
      await store.close();
    }
  },
);
