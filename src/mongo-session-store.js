import { MongoClient } from "mongodb";

import { applyQueuedPrompts, buildUpsertSession, takeFeedbackFromSession } from "./session-model.js";
import { canonicalFile, sessionKey } from "./session-store.js";

export class MongoSessionStore {
  constructor({ url, dbName = "lavish_axi", collectionName = "sessions" } = {}) {
    if (!url) {
      throw new Error("MongoSessionStore requires a MongoDB connection URL");
    }
    this.url = url;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.backend = "mongo";
    this.client = null;
    this.collection = null;
  }

  async connect() {
    if (this.collection) return;
    this.client = new MongoClient(this.url);
    await this.client.connect();
    this.collection = this.client.db(this.dbName).collection(this.collectionName);
    await this.collection.createIndex({ file: 1 });
    await this.collection.createIndex({ updated_at: -1 });
  }

  async close() {
    if (!this.client) return;
    await this.client.close();
    this.client = null;
    this.collection = null;
  }

  docToSession(doc) {
    if (!doc) return null;
    const { _id, ...session } = doc;
    return session;
  }

  async listSessions() {
    await this.connect();
    const docs = await this.collection.find({}).sort({ file: 1 }).toArray();
    return docs.map((doc) => this.docToSession(doc));
  }

  async findByFile(file) {
    const absolute = await canonicalFile(file);
    return this.findByKey(sessionKey(absolute));
  }

  async findByKey(key) {
    await this.connect();
    const doc = await this.collection.findOne({ _id: key });
    return this.docToSession(doc);
  }

  async upsertSession(file, url) {
    await this.connect();
    const absolute = await canonicalFile(file);
    const key = sessionKey(absolute);
    const existing = await this.findByKey(key);
    const session = buildUpsertSession({ key, file: absolute, url, existing });
    await this.collection.updateOne({ _id: key }, { $set: session }, { upsert: true });
    return session;
  }

  async queuePrompts(key, payload) {
    await this.connect();
    const session = await this.findByKey(key);
    if (!session) {
      return null;
    }
    const updated = applyQueuedPrompts(session, payload);
    await this.collection.updateOne({ _id: key }, { $set: updated });
    return updated;
  }

  async takeFeedback(key) {
    await this.connect();
    const session = await this.findByKey(key);
    const outcome = takeFeedbackFromSession(session);
    if (outcome.kind === "feedback") {
      await this.collection.updateOne({ _id: key }, { $set: outcome.session });
    }
    return outcome.result;
  }

  async endSession(key) {
    await this.connect();
    const session = await this.findByKey(key);
    if (!session) {
      return null;
    }
    const updated = {
      ...session,
      status: "ended",
      updated_at: new Date().toISOString(),
    };
    await this.collection.updateOne({ _id: key }, { $set: updated });
    return updated;
  }

  async addAgentReply(key, text) {
    await this.connect();
    const session = await this.findByKey(key);
    if (!session) {
      return null;
    }
    const updated = {
      ...session,
      chat: [...(session.chat || []), { role: "agent", text: String(text || ""), at: new Date().toISOString() }],
      updated_at: new Date().toISOString(),
    };
    await this.collection.updateOne({ _id: key }, { $set: updated });
    return updated;
  }
}
