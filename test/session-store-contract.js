import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function runSessionStoreContract(name, createStore) {
  const dir = await mkdtemp(path.join(tmpdir(), `lavish-store-${name}-`));
  try {
    const artifact = path.join(dir, "artifact.html");
    await writeFile(artifact, "<h1>Hello</h1>");

    const store = await createStore(dir);
    try {
      const session = await store.upsertSession(artifact, "http://127.0.0.1:4387/session/test");
      await store.queuePrompts(session.key, {
        domSnapshot: 'uid=1 h1 "Hello"',
        prompts: [{ uid: "1", prompt: "Make this warmer", selector: "h1", tag: "h1", text: "Hello" }],
      });

      const first = await store.takeFeedback(session.key);
      assert.equal(first.status, "feedback");
      assert.equal(first.dom_snapshot, 'uid=1 h1 "Hello"');
      assert.deepEqual(first.prompts, [
        { uid: "1", prompt: "Make this warmer", selector: "h1", tag: "h1", text: "Hello" },
      ]);

      const second = await store.takeFeedback(session.key);
      assert.equal(second.status, "waiting");

      const reopened = await store.upsertSession(artifact, "http://127.0.0.1:4387/session/test-2");
      await store.addAgentReply(reopened.key, "Applied the requested changes.");
      const withReply = await store.findByKey(reopened.key);
      assert.deepEqual(
        withReply.chat.map((item) => [item.role, item.text]),
        [["agent", "Applied the requested changes."]],
      );

      await store.endSession(reopened.key);
      assert.equal((await store.takeFeedback(reopened.key)).status, "ended");
    } finally {
      if (typeof store.close === "function") {
        await store.close();
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
