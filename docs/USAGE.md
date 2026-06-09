# Lavish Editor — usage (reachkrishnaraj fork)

**This is a separate project.** Not part of confluence-signal-hub or any consumer repo. Install globally from this directory; configure storage here or in `~/.lavish-axi/env.local`.

Version **0.2.0+**. See [FORK.md](../FORK.md) for changelog.

## Install

```bash
cd ~/personal_workarea/hobby_projects/lavish-axi-mongo
pnpm install && pnpm run build && npm install -g .
lavish-axi --version
lavish-axi stop   # restart after upgrade
```

## Configure Mongo (recommended)

```bash
cp .env.lavish.example .env.lavish.local
```

Edit `.env.lavish.local`:

```bash
LAVISH_AXI_STORE=mongodb://localhost:27017/confluence
```

Or use global config (works from any project directory):

```bash
mkdir -p ~/.lavish-axi
cp .env.lavish.example ~/.lavish-axi/env.local
# edit ~/.lavish-axi/env.local
```

The CLI auto-loads `.env.lavish.local` (walks up from cwd) or `~/.lavish-axi/env.local`. Collection: **`sessions`** (auto-created).

Verify:

```bash
lavish-axi stop
curl -s http://127.0.0.1:4387/health | jq .store
```

## Commands

Run from **any** directory (e.g. a consumer project's HTML artifacts):

```bash
lavish-axi open /path/to/project/.lavish/replay-data-layer/open-questions.html
lavish-axi poll /path/to/project/.lavish/replay-data-layer/open-questions.html
lavish-axi playbook comparison
lavish-axi design
lavish-axi end /path/to/artifact.html
lavish-axi stop
```

**Do not use** `npx -y lavish-axi` — that is upstream npm without this fork's fixes.

## Child-page annotation fix

Multi-page artifacts (e.g. `index.html` + `open-questions.html` in the same folder) all get the Lavish SDK injected when served under `/artifact/{key}/`. You can annotate on every `.html` sibling page, not only `index.html`.

Implementation: `src/server.js` + `isServableHtml()` in `src/html-transform.js`.

## Fork fixes (summary)

1. Mongo / SQLite / file session stores — [STORE.md](../STORE.md)
2. SDK on **all** artifact HTML pages (child-page annotation)
3. Composer draft persistence + submit ACK/errors + 3s snapshot timeout
4. Auto-load env files

## Reviewing confluence-signal-hub artifacts

That repo only holds HTML under `.lavish/replay-data-layer/`. Tooling lives here:

```bash
lavish-axi open ~/personal_workarea/hobby_projects/confluence-signal-hub/.lavish/replay-data-layer/open-questions.html
lavish-axi poll ~/personal_workarea/hobby_projects/confluence-signal-hub/.lavish/replay-data-layer/open-questions.html
```

Gate 4 session keys: `open-questions.html` → `50ce3a945622100e`, `approaches.html` → `3a88bb624ea18c48`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Submit does nothing | Fork `0.2.0+`; `lavish-axi stop`; hard-refresh browser |
| Child page won't annotate | Must use this fork (SDK injection on all `.html`) |
| Poll interrupted | Re-open session; poll with no short shell timeout |
| Wrong backend | `curl localhost:4387/health` |
