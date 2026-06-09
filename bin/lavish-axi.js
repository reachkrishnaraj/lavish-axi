#!/usr/bin/env node
import { loadLavishEnv } from "../src/load-env.js";
import { run } from "../src/cli.js";

loadLavishEnv();
await run(process.argv.slice(2));
