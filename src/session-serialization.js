export function serializeSessionRow(session) {
  return {
    key: session.key,
    file: session.file,
    url: session.url,
    status: session.status,
    pending_prompts: session.pending_prompts || 0,
    prompts_json: JSON.stringify(session.prompts || []),
    dom_snapshot: session.dom_snapshot || "",
    chat_json: JSON.stringify(session.chat || []),
    updated_at: session.updated_at,
  };
}

export function deserializeSessionRow(row) {
  if (!row) return null;
  return {
    key: row.key,
    file: row.file,
    url: row.url,
    status: row.status,
    pending_prompts: row.pending_prompts || 0,
    prompts: JSON.parse(row.prompts_json || "[]"),
    dom_snapshot: row.dom_snapshot || "",
    chat: JSON.parse(row.chat_json || "[]"),
    updated_at: row.updated_at,
  };
}
