# Lavish session storage

Lavish persists review sessions through a pluggable `SessionStore` interface. Pick a backend with `LAVISH_AXI_STORE`.

## Backends

| Backend | `LAVISH_AXI_STORE` | Default location |
|---------|-------------------|------------------|
| **File** (default) | unset, `file`, or `file:///path/state.json` | `~/.lavish-axi/state.json` |
| **SQLite** | `sqlite`, `sqlite:///path/state.sqlite`, or a `.sqlite`/`.db` path | `~/.lavish-axi/state.sqlite` |
| **MongoDB** | `mongodb://...`, `mongodb+srv://...`, `mongo`, or `mongodb` | DB from URL path or `lavish_axi` |

### MongoDB

```bash
# Full connection string (database name taken from URL path)
export LAVISH_AXI_STORE='mongodb://localhost:27017/confluence'

# Or alias + shared env var
export LAVISH_AXI_STORE=mongo
export MONGODB_URL='mongodb://localhost:27017/confluence'

# Override database name
export LAVISH_AXI_STORE_DB=lavish_axi
```

Mongo stores one document per session in a `sessions` collection (`_id` = session key).

### SQLite

Single-file, no daemon. Good for local durability without Mongo.

```bash
export LAVISH_AXI_STORE=sqlite
# or
export LAVISH_AXI_STORE=sqlite://$HOME/.lavish-axi/custom.sqlite
```

Requires Node.js 22+ (`node:sqlite`).

## Health check

`GET /health` includes the active backend:

```json
{ "ok": true, "app": "lavish-axi", "version": "0.2.0-store.1", "store": { "backend": "file", "file": "/Users/you/.lavish-axi/state.json" } }
```

## Interface

All backends implement:

- `listSessions()`, `findByFile(file)`, `findByKey(key)`
- `upsertSession(file, url)`, `queuePrompts(key, payload)`, `takeFeedback(key)`
- `endSession(key)`, `addAgentReply(key, text)`
- `backend`: `"file"` | `"sqlite"` | `"mongo"`
- `close()` (sqlite + mongo)
