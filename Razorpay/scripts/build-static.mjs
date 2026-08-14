// Build the GitHub Pages copy of AgentGuard into ../docs/agentguard/.
//
//   node scripts/build-static.mjs            -> ../docs/agentguard
//   node scripts/build-static.mjs --serve     -> ./out at the site root, for
//                                               `npx serve out` before pushing
//
// `output: "export"` refuses to build an app that has route handlers, and this
// app has two. They are correct for the server build and are not deleted — they
// are moved aside for the duration of the export and moved straight back, in a
// finally block, so an interrupted build cannot leave the tree missing them.
// The pipeline they wrap still runs; it just runs in the browser instead.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(root, "app", "api");
const parked = join(root, ".api-parked");
const outDir = join(root, "out");

const serveMode = process.argv.includes("--serve");
const dest = join(dirname(root), "docs", "agentguard");
const basePath = serveMode ? "" : "/ai-builder-projects/agentguard";

// A previous run that was killed mid-build would have left the routes parked.
if (existsSync(parked) && !existsSync(apiDir)) {
  renameSync(parked, apiDir);
  console.log("restored app/api from an interrupted run");
}

rmSync(outDir, { recursive: true, force: true });

let moved = false;
try {
  if (existsSync(apiDir)) {
    renameSync(apiDir, parked);
    moved = true;
  }

  execFileSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_STATIC: "1", STATIC_BASE_PATH: basePath },
  });
} finally {
  if (moved && existsSync(parked)) renameSync(parked, apiDir);
}

// Jekyll is GitHub Pages' default processor and it drops any directory whose
// name starts with an underscore — which is every Next.js asset. Without this
// file the page loads and every script 404s.
writeFileSync(join(outDir, ".nojekyll"), "");

if (!serveMode) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(outDir, dest, { recursive: true });
  console.log(`\nAgentGuard exported to docs/agentguard/ (basePath ${basePath})`);
} else {
  console.log("\nAgentGuard exported to out/ at the site root — npx serve out");
}
