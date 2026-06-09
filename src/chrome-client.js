/* global EventSource, document, location, window */

const sessionDataElement = document.getElementById("lavish-session");
const sessionData = JSON.parse(sessionDataElement?.textContent || "{}");
const key = String(sessionData.key || "");
const queueStorageKey = "lavish-axi:queued:" + key;
const draftStorageKey = "lavish-axi:draft:" + key;
const initialChat = Array.isArray(sessionData.initialChat) ? sessionData.initialChat : [];
const SNAPSHOT_TIMEOUT_MS = 3000;

const frame = /** @type {HTMLIFrameElement} */ (document.getElementById("artifact"));
const annotationPills = /** @type {HTMLDivElement} */ (document.getElementById("annotationPills"));
const chatLog = /** @type {HTMLDivElement} */ (document.getElementById("chatLog"));
const chatInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("chatInput"));
const sendButton = /** @type {HTMLButtonElement} */ (document.getElementById("send"));
const annotationButton = /** @type {HTMLButtonElement} */ (document.getElementById("annotation"));
const endButton = /** @type {HTMLButtonElement} */ (document.getElementById("end"));
const filePathInput = /** @type {HTMLInputElement} */ (document.getElementById("filePath"));
const copyPathButton = /** @type {HTMLButtonElement} */ (document.getElementById("copyPath"));
const presenceBanner = /** @type {HTMLDivElement} */ (document.getElementById("presenceBanner"));
const submitStatus = /** @type {HTMLDivElement} */ (document.getElementById("submitStatus"));

const queued = loadQueuedPrompts();
let annotation = true;
let agentPresence = "waiting";
let pendingSnapshot = "";
let workingBubble = null;
let submitQueuedPromise = null;
let submitQueuedAgain = false;
let snapshotWaitTimer = null;
let submitStatusTimer = null;
let lastScroll = { x: 0, y: 0 };

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function loadQueuedPrompts() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(queueStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((prompt) => prompt && typeof prompt === "object") : [];
  } catch {
    return [];
  }
}

function loadComposerDraft() {
  try {
    return sessionStorage.getItem(draftStorageKey) || "";
  } catch {
    return "";
  }
}

function persistQueuedPrompts() {
  try {
    if (queued.length) {
      sessionStorage.setItem(queueStorageKey, JSON.stringify(queued));
    } else {
      sessionStorage.removeItem(queueStorageKey);
    }
  } catch {
    // The in-memory queue still works if browser storage is unavailable.
  }
}

function persistComposerDraft() {
  try {
    const value = chatInput.value;
    if (value) {
      sessionStorage.setItem(draftStorageKey, value);
    } else {
      sessionStorage.removeItem(draftStorageKey);
    }
  } catch {
    // Draft persistence is best-effort.
  }
}

function clearComposerDraft() {
  try {
    sessionStorage.removeItem(draftStorageKey);
  } catch {
    // Ignore storage failures.
  }
}

function showSubmitStatus(message, tone = "info") {
  if (!submitStatus) return;
  if (submitStatusTimer) {
    clearTimeout(submitStatusTimer);
    submitStatusTimer = null;
  }
  submitStatus.hidden = false;
  submitStatus.className = "submit-status is-" + tone;
  submitStatus.textContent = message;
  if (tone !== "error") {
    submitStatusTimer = setTimeout(() => {
      submitStatus.hidden = true;
      submitStatus.textContent = "";
      submitStatusTimer = null;
    }, 4000);
  }
}

function render() {
  annotationPills.innerHTML = queued
    .map(
      (prompt, index) =>
        '<div class="pill-wrap"><div class="pill"><span class="pill-preview">' +
        escapeHtml(prompt.prompt) +
        '</span><button class="pill-close" type="button" aria-label="Remove queued prompt" data-index="' +
        index +
        '">×</button></div><div class="pill-tooltip">' +
        (prompt.selector
          ? '<div class="tooltip-label">Target</div><div class="pill-tooltip-target">' +
            escapeHtml(prompt.selector) +
            "</div>"
          : "") +
        '<div class="tooltip-label">Prompt</div><div class="pill-tooltip-prompt">' +
        escapeHtml(prompt.prompt) +
        "</div></div></div>",
    )
    .join("");

  for (const button of annotationPills.querySelectorAll(".pill-close")) {
    const closeButton = /** @type {HTMLButtonElement} */ (button);
    closeButton.addEventListener("click", (event) => removeQueuedPrompt(Number(closeButton.dataset.index), event));
  }
}

function addChat(role, text) {
  if (!text) return;

  const el = document.createElement("div");
  el.className = "bubble " + role;
  el.innerHTML = "<small>" + (role === "agent" ? "Agent" : "You") + "</small><div>" + escapeHtml(text) + "</div>";
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function syncChat(chat) {
  for (const el of [...chatLog.querySelectorAll(".bubble.user,.bubble.agent:not(.agent-working)")]) {
    el.remove();
  }

  for (const item of chat) addChat(item.role, item.text);
  if (workingBubble) chatLog.appendChild(workingBubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setAgentPresence(state) {
  agentPresence = state === "listening" || state === "working" ? state : "waiting";
  sendButton.disabled = agentPresence === "working" || Boolean(submitQueuedPromise);
  if (presenceBanner) presenceBanner.hidden = agentPresence !== "waiting";

  if (agentPresence !== "working") {
    if (workingBubble) workingBubble.remove();
    workingBubble = null;
    return;
  }

  if (!workingBubble) {
    workingBubble = document.createElement("div");
    workingBubble.className = "bubble agent agent-working";
    workingBubble.innerHTML = '<span class="spinner"></span><span>Working...</span>';
    chatLog.appendChild(workingBubble);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function removeQueuedPrompt(index, event) {
  if (event) event.stopPropagation();
  queued.splice(index, 1);
  persistQueuedPrompts();
  render();
}

function postToFrame(message) {
  if (frame.contentWindow) frame.contentWindow.postMessage(message, "*");
}

function clearSnapshotWait() {
  if (snapshotWaitTimer) {
    clearTimeout(snapshotWaitTimer);
    snapshotWaitTimer = null;
  }
}

function requestSnapshotAndSubmit() {
  postToFrame({ type: "lavish:requestSnapshot" });
  clearSnapshotWait();
  snapshotWaitTimer = setTimeout(() => {
    snapshotWaitTimer = null;
    pendingSnapshot = pendingSnapshot || "";
    void deliverQueuedPrompts({ snapshotTimedOut: true });
  }, SNAPSHOT_TIMEOUT_MS);
}

function sendQueued() {
  if (agentPresence === "working" || submitQueuedPromise) return;

  const text = chatInput.value.trim();
  if (text) {
    queued.push({ uid: "", prompt: text, selector: "", tag: "message", text: "Freeform message" });
    persistQueuedPrompts();
    addChat("user", text);
    chatInput.value = "";
    clearComposerDraft();
    render();
  }
  if (!queued.length) return;

  requestSnapshotAndSubmit();
}

async function deliverQueuedPrompts({ snapshotTimedOut = false } = {}) {
  try {
    await submitQueued();
    if (snapshotTimedOut) {
      showSubmitStatus("Feedback sent without a page snapshot. Annotations may be less precise.", "info");
    } else {
      showSubmitStatus("Feedback sent to agent.", "success");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not send feedback.";
    showSubmitStatus(detail + " Your queue is saved — try again.", "error");
  }
}

async function submitQueued() {
  if (submitQueuedPromise) {
    submitQueuedAgain = true;
    return submitQueuedPromise;
  }

  let succeeded = false;
  sendButton.disabled = true;
  submitQueuedPromise = submitQueuedOnce();
  try {
    const result = await submitQueuedPromise;
    succeeded = true;
    return result;
  } finally {
    submitQueuedPromise = null;
    sendButton.disabled = agentPresence === "working";
    const shouldSubmitAgain = submitQueuedAgain;
    submitQueuedAgain = false;
    if (succeeded && shouldSubmitAgain && queued.length) sendQueued();
  }
}

async function submitQueuedOnce() {
  const prompts = queued.slice();
  const response = await fetch("/api/" + key + "/prompts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompts, domSnapshot: pendingSnapshot }),
  });
  if (!response.ok) {
    let detail = "Failed to submit queued prompts.";
    try {
      const body = await response.json();
      if (body && body.error) detail = String(body.error);
    } catch {
      // Keep the default message when the error body is not JSON.
    }
    throw new Error(detail);
  }
  for (const prompt of prompts) {
    const index = queued.indexOf(prompt);
    if (index !== -1) queued.splice(index, 1);
  }
  persistQueuedPrompts();
  render();
  if (agentPresence === "listening") setAgentPresence("working");
}

async function endSession() {
  await fetch("/api/" + key + "/end", { method: "POST" });
  document.body.innerHTML =
    '<div class="bar"><div class="brand"><span class="brand-mark">Lavish</span><span class="brand-support">Editor</span></div></div><main class="ended-view"><section class="ended-card"><div class="ended-title">Session ended.</div><p class="ended-copy">Return to your agent to continue.</p></section></main>';
}

async function copyFilePath() {
  try {
    await navigator.clipboard.writeText(filePathInput.value);
  } catch {
    filePathInput.select();
    document.execCommand("copy");
  }

  copyPathButton.textContent = "Copied";
  setTimeout(() => {
    copyPathButton.textContent = "Copy Path";
  }, 1200);
}

async function reloadAfterServerRestart() {
  let sawOutage = false;
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch("/health", { cache: "no-store" });
      if (sawOutage && res.ok) {
        location.reload();
        return;
      }
    } catch {
      sawOutage = true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  location.reload();
}

window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return;

  const msg = event.data || {};
  if (msg.type === "lavish:queuePrompt") {
    queued.push(msg.prompt);
    persistQueuedPrompts();
    render();
  }
  if (msg.type === "lavish:snapshot") {
    clearSnapshotWait();
    pendingSnapshot = msg.snapshot || "";
    void deliverQueuedPrompts();
  }
  if (msg.type === "lavish:scroll") {
    lastScroll = { x: Number(msg.x) || 0, y: Number(msg.y) || 0 };
  }
  if (msg.type === "lavish:sendQueuedPrompts") sendQueued();
  if (msg.type === "lavish:endSession") endSession();
});

annotationButton.onclick = () => {
  annotation = !annotation;
  annotationButton.textContent = "Annotation: " + (annotation ? "On" : "Off");
  annotationButton.classList.toggle("annotation-on", annotation);
  postToFrame({ type: "lavish:setAnnotationMode", enabled: annotation });
};

sendButton.onclick = sendQueued;
chatInput.addEventListener("input", persistComposerDraft);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendQueued();
  }
});
copyPathButton.onclick = copyFilePath;
endButton.onclick = endSession;
frame.addEventListener("load", () => {
  postToFrame({ type: "lavish:setAnnotationMode", enabled: annotation });
  // Replay the pre-reload scroll position so hot reloads don't jump the artifact to the top.
  postToFrame({ type: "lavish:restoreScroll", x: lastScroll.x, y: lastScroll.y });
});

const events = new EventSource("/events/" + key);
events.addEventListener("reload", () => {
  // The iframe is sandboxed, so reload by resetting the iframe URL from chrome.
  // eslint-disable-next-line no-self-assign
  frame.src = frame.src;
});
events.addEventListener("chrome-reload", () => reloadAfterServerRestart());
events.addEventListener("agent-reply", (event) => addChat("agent", JSON.parse(event.data).text));
events.addEventListener("chat-sync", (event) => syncChat(JSON.parse(event.data).chat || []));
events.addEventListener("agent-presence", (event) => setAgentPresence(JSON.parse(event.data).state));

chatInput.value = loadComposerDraft();
render();
initialChat.forEach((item) => addChat(item.role, item.text));
setAgentPresence("waiting");
