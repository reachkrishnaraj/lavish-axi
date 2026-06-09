# reachkrishnaraj/lavish-axi fork

Fork of [kunchenguid/lavish-axi](https://github.com/kunchenguid/lavish-axi) with durable session storage, review UX fixes, and project-local env loading. Version **0.2.0**.

Upstream baseline: `0.1.20`. This fork is intended for dogfooding and eventual PR / maintained release under [reachkrishnaraj/lavish-axi](https://github.com/reachkrishnaraj/lavish-axi).

## What changed

### 1. Pluggable session storage (`SessionStore`)

| Backend | `LAVISH_AXI_STORE` | Default |
|---------|-------------------|---------|
| **File** | unset, `file` | `~/.lavish-axi/state.json` |
| **SQLite** | `sqlite`, `sqlite:///path.sqlite` | `~/.lavish-axi/state.sqlite` |
| **MongoDB** | `mongodb://...`, `mongo` + `MONGODB_URL` | DB from URL path or `lavish_axi` |

Mongo collection: **`sessions`** (auto-created). One document per review session (`_id` = session key).

See [STORE.md](./STORE.md) for full env reference.

### 2. Review persistence UX

- **SDK on all artifact HTML** — sibling pages under `/artifact/{key}/` get `injectLavishSdk()`, not only `index.html`.
- **Composer draft** — sidebar textarea saved to `sessionStorage` (`lavish-axi:draft:{key}`).
- **Submit reliability** — 3s snapshot timeout fallback, visible success/error status, queue kept on failure.

### 3. Project-local env files

CLI loads the first matching file (does not override vars already in the shell):

1. `LAVISH_AXI_ENV_FILE` (if set)
2. `.env.lavish.local` walking up from cwd
3. `~/.lavish-axi/env.local` (or `LAVISH_AXI_STATE_DIR/env.local`)

Copy [.env.lavish.example](./.env.lavish.example) → `.env.lavish.local` and set your Mongo URL.

### 4. Health endpoint

`GET /health` includes active store:

```json
{ "ok": true, "app": "lavish-axi", "version": "0.2.0", "store": { "backend": "mongo", "dbName": "confluence" } }
```

## Install globally

```bash
cd /path/to/lavish-axi-mongo   # or your clone of reachkrishnaraj/lavish-axi
pnpm install
pnpm run build
npm install -g .
lavish-axi --version   # 0.2.0
```

Restart after upgrade:

```bash
lavish-axi stop
```

## Revert to npm release

```bash
npm uninstall -g lavish-axi
npm install -g lavish-axi
```

## Consumer projects (e.g. confluence-signal-hub)

Lavish is **not** part of consumer repos. They only contain HTML artifacts (e.g. `.lavish/replay-data-layer/*.html`). Install this fork globally, configure via `.env.lavish.local` here or `~/.lavish-axi/env.local`, then run `lavish-axi open <absolute-path-to-html>` from anywhere.

See [docs/USAGE.md](./docs/USAGE.md).

## Development

```bash
pnpm run check    # build + lint + test
node --test test/load-env.test.js
```

## Files touched (fork delta)

| Area | Files |
|------|-------|
| Store | `src/session-store.js`, `src/sqlite-session-store.js`, `src/mongo-session-store.js`, `src/create-session-store.js`, `src/session-model.js`, `src/session-serialization.js` |
| Env | `src/load-env.js`, `bin/lavish-axi.js` |
| UX | `src/chrome-client.js`, `src/chrome.css`, `src/server.js`, `src/html-transform.js` |
| Docs | `FORK.md`, `STORE.md`, `docs/USAGE.md`, `AGENTS.md`, `.env.lavish.example` |
