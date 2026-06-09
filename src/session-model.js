export function normalizePrompt(prompt) {
  const normalized = {
    uid: String(prompt.uid || ""),
    prompt: String(prompt.prompt || ""),
    selector: String(prompt.selector || ""),
    tag: String(prompt.tag || ""),
    text: String(prompt.text || ""),
  };
  const target = normalizeTarget(prompt.target);
  if (target) normalized.target = target;
  return normalized;
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  return JSON.parse(JSON.stringify(target));
}

export function buildUpsertSession({ key, file, url, existing }) {
  return {
    key,
    file,
    url,
    status: existing?.status === "ended" ? "open" : existing?.status || "open",
    pending_prompts: existing?.pending_prompts || 0,
    prompts: existing?.prompts || [],
    dom_snapshot: existing?.dom_snapshot || "",
    chat: existing?.chat || [],
    updated_at: new Date().toISOString(),
  };
}

export function applyQueuedPrompts(session, payload) {
  const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
  const normalizedPrompts = prompts.map(normalizePrompt);
  const userMessages = normalizedPrompts
    .filter((prompt) => prompt.tag === "message" && prompt.prompt)
    .map((prompt) => ({ role: "user", text: prompt.prompt, at: new Date().toISOString() }));
  return {
    ...session,
    prompts: [...(session.prompts || []), ...normalizedPrompts],
    chat: [...(session.chat || []), ...userMessages],
    pending_prompts: (session.prompts || []).length + normalizedPrompts.length,
    dom_snapshot: String(payload.domSnapshot || payload.dom_snapshot || ""),
    status: "feedback",
    updated_at: new Date().toISOString(),
  };
}

export function takeFeedbackFromSession(session) {
  if (!session) {
    return { kind: "result", result: { status: "missing" } };
  }
  if (session.status === "ended") {
    return { kind: "result", result: { status: "ended" } };
  }
  const prompts = session.prompts || [];
  if (prompts.length === 0) {
    return { kind: "result", result: { status: "waiting" } };
  }
  return {
    kind: "feedback",
    result: {
      status: "feedback",
      dom_snapshot: session.dom_snapshot || "",
      prompts,
    },
    session: {
      ...session,
      prompts: [],
      pending_prompts: 0,
      dom_snapshot: "",
      status: "open",
      updated_at: new Date().toISOString(),
    },
  };
}
