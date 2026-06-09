import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { applyQueuedPrompts, buildUpsertSession, takeFeedbackFromSession } from "./session-model.js";
import { deserializeSessionRow, serializeSessionRow } from "./session-serialization.js";
import { canonicalFile, sessionKey } from "./session-store.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  key TEXT PRIMARY KEY,
  file TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  pending_prompts INTEGER NOT NULL DEFAULT 0,
  prompts_json TEXT NOT NULL DEFAULT '[]',
  dom_snapshot TEXT NOT NULL DEFAULT '',
  chat_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_file_idx ON sessions(file);
CREATE INDEX IF NOT EXISTS sessions_updated_at_idx ON sessions(updated_at DESC);
`;

export class SqliteSessionStore {
  constructor(file) {
    if (!file) {
      throw new Error("SqliteSessionStore requires a database file path");
    }
    this.file = file;
    this.backend = "sqlite";
    this.db = null;
  }

  async connect() {
    if (this.db) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(SCHEMA_SQL);
  }

  async close() {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }

  readSession(key) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE key = ?").get(key);
    return deserializeSessionRow(row);
  }

  writeSession(session) {
    const row = serializeSessionRow(session);
    this.db
      .prepare(
        `INSERT INTO sessions (
          key, file, url, status, pending_prompts, prompts_json, dom_snapshot, chat_json, updated_at
        ) VALUES (
          @key, @file, @url, @status, @pending_prompts, @prompts_json, @dom_snapshot, @chat_json, @updated_at
        )
        ON CONFLICT(key) DO UPDATE SET
          file = excluded.file,
          url = excluded.url,
          status = excluded.status,
          pending_prompts = excluded.pending_prompts,
          prompts_json = excluded.prompts_json,
          dom_snapshot = excluded.dom_snapshot,
          chat_json = excluded.chat_json,
          updated_at = excluded.updated_at`,
      )
      .run(row);
  }

  async listSessions() {
    await this.connect();
    const rows = this.db.prepare("SELECT * FROM sessions ORDER BY file ASC").all();
    return rows.map((row) => deserializeSessionRow(row));
  }

  async findByFile(file) {
    const absolute = await canonicalFile(file);
    return this.findByKey(sessionKey(absolute));
  }

  async findByKey(key) {
    await this.connect();
    return this.readSession(key);
  }

  async upsertSession(file, url) {
    await this.connect();
    const absolute = await canonicalFile(file);
    const key = sessionKey(absolute);
    const existing = this.readSession(key);
    const session = buildUpsertSession({ key, file: absolute, url, existing });
    this.writeSession(session);
    return session;
  }

  async queuePrompts(key, payload) {
    await this.connect();
    const session = this.readSession(key);
    if (!session) {
      return null;
    }
    const updated = applyQueuedPrompts(session, payload);
    this.writeSession(updated);
    return updated;
  }

  async takeFeedback(key) {
    await this.connect();
    const session = this.readSession(key);
    const outcome = takeFeedbackFromSession(session);
    if (outcome.kind === "feedback") {
      this.writeSession(outcome.session);
    }
    return outcome.result;
  }

  async endSession(key) {
    await this.connect();
    const session = this.readSession(key);
    if (!session) {
      return null;
    }
    const updated = {
      ...session,
      status: "ended",
      updated_at: new Date().toISOString(),
    };
    this.writeSession(updated);
    return updated;
  }

  async addAgentReply(key, text) {
    await this.connect();
    const session = this.readSession(key);
    if (!session) {
      return null;
    }
    const updated = {
      ...session,
      chat: [...(session.chat || []), { role: "agent", text: String(text || ""), at: new Date().toISOString() }],
      updated_at: new Date().toISOString(),
    };
    this.writeSession(updated);
    return updated;
  }
}
