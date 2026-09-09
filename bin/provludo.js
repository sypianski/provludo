#!/usr/bin/env node
/* provludo CLI — dress rehearsal for your slides.
 *
 *   provludo new <name>        bootstrap a project and open the editor
 *   provludo [path]            serve a project dir / draft.md / deck.html
 *   provludo --root <dir>      serve every project under a directory
 *   provludo migrate <file.md> rewrite v1 (slaydilo) markers to v2
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "../lib/server.js";
import { loadProject, draftOnlyProject, deckOnlyProject, MANIFEST_NAME } from "../lib/project.js";
import { migrateDraft } from "../lib/format.js";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `provludo — dress rehearsal for your slides

Usage:
  provludo new <name>         create a project, start the server, open browser
  provludo [path]             serve: project dir (default .), draft .md, or deck .html
  provludo --root <dir>       serve all projects/decks under <dir>, with a landing page
  provludo migrate <file.md>  rewrite v1 (Polish slaydilo) markers to v2 (English)

Options:
  --port <n>     port (default 8765)
  --host <addr>  bind address (default 127.0.0.1; 0.0.0.0 to expose)
  --tailnet      bind to this machine's tailscale IP, print MagicDNS URL
  --no-open      don't open the browser
  -h, --help     this help
  -v, --version  version
`;

function parseArgs(argv) {
  const opts = { port: 8765, host: "127.0.0.1", open: true, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") { opts.port = parseInt(argv[++i], 10); opts.portExplicit = true; }
    else if (a === "--host") opts.host = argv[++i];
    else if (a === "--root") opts.root = argv[++i];
    else if (a === "--tailnet") opts.tailnet = true;
    else if (a === "--no-open") opts.open = false;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "-v" || a === "--version") opts.version = true;
    else if (a.startsWith("-")) fail(`unknown option: ${a}\n\n${HELP}`);
    else opts.positional.push(a);
  }
  return opts;
}

function fail(msg) {
  console.error(`provludo: ${msg}`);
  process.exit(1);
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
            : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch { /* headless — fine */ }
}

async function cmdMigrate(file) {
  if (!file) fail("migrate: missing file argument");
  const src = await fsp.readFile(file, "utf8").catch(() => fail(`cannot read ${file}`));
  const out = migrateDraft(src);
  if (out === src) {
    console.log(`${file}: already v2, nothing to do`);
    return;
  }
  const bak = file + ".v1.bak";
  await fsp.writeFile(bak, src);
  await fsp.writeFile(file, out);
  console.log(`${file}: migrated to v2 (backup: ${path.basename(bak)})`);
}

async function cmdNew(name, opts) {
  if (!name) fail("new: missing project name (provludo new my-talk)");
  const dir = path.resolve(name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length)
    fail(`${name}: directory exists and is not empty`);
  await fsp.mkdir(dir, { recursive: true });
  const manifest = {
    name: path.basename(dir),
    draft: "draft.md",
    deck: "deck/index.html",
  };
  await fsp.writeFile(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + "\n");
  await fsp.copyFile(path.join(PKG, "templates", "draft.md"), path.join(dir, "draft.md"));
  await fsp.copyFile(path.join(PKG, "AGENT.md"), path.join(dir, "AGENT.md"))
    .catch(() => {});   /* AGENT.md ships with the package */
  console.log(`Created ${dir}`);
  console.log(`  ${MANIFEST_NAME} — project manifest`);
  console.log(`  draft.md      — your draft (this is the canonical source)`);
  console.log(`  AGENT.md      — contract for your AI agent`);
  return serve({ ...opts, positional: [dir] });
}

async function serve(opts) {
  let serverOpts;
  if (opts.root) {
    const root = path.resolve(opts.root);
    if (!fs.existsSync(root)) fail(`--root ${opts.root}: no such directory`);
    serverOpts = { mode: "root", root };
  } else {
    const target = path.resolve(opts.positional[0] || ".");
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      if (!fs.existsSync(path.join(target, MANIFEST_NAME)))
        fail(`${target} has no ${MANIFEST_NAME} — run \`provludo new <name>\` to start a project,\n` +
             `or point provludo at a draft .md / deck .html file directly`);
      loadProject(target);   /* validate manifest early, fail loudly */
      serverOpts = { mode: "project", target };
    } else if (/\.md$/i.test(target)) {
      if (!fs.existsSync(target)) {
        await fsp.copyFile(path.join(PKG, "templates", "draft.md"), target);
        console.log(`Created ${target}`);
      }
      serverOpts = { mode: "draft", project: draftOnlyProject(target) };
    } else if (/\.html?$/i.test(target)) {
      if (!fs.existsSync(target)) fail(`${target}: no such file`);
      serverOpts = { mode: "deck", project: deckOnlyProject(target) };
    } else {
      fail(`${target}: not a project directory, .md draft or .html deck`);
    }
  }

  let urlHost = opts.host;
  if (opts.tailnet) {
    const { tailnetAddress } = await import("../lib/tailnet.js");
    try {
      const t = tailnetAddress();
      opts.host = t.ip;
      urlHost = t.urlHost;
    } catch (e) {
      fail(e.message);
    }
  }

  const server = createServer(serverOpts);
  let port = opts.port;
  const onListen = () => {
    const url = `http://${urlHost}:${port}/`;
    const what = serverOpts.mode === "root" ? serverOpts.root
      : serverOpts.mode === "project" ? path.basename(serverOpts.target)
      : serverOpts.project.name;
    console.log(`provludo: ${what} → ${url}  (Ctrl+C to stop)`);
    if (opts.open) openBrowser(url);
  };
  server.on("listening", onListen);   /* fires once — retries below reuse it */
  server.on("error", e => {
    if (e.code === "EADDRINUSE") {
      /* explicit --port: fail loudly; default port: walk up to a free one */
      if (opts.portExplicit) fail(`port ${port} is taken (use a different --port)`);
      if (++port > opts.port + 20) fail(`no free port in ${opts.port}–${port - 1}`);
      server.listen(port, opts.host);
      return;
    }
    fail(String(e.message || e));
  });
  server.listen(port, opts.host);
}

/* ── main ─────────────────────────────────────────── */
const argv = process.argv.slice(2);
const cmd = argv[0];
if (cmd === "new") {
  const opts = parseArgs(argv.slice(1));
  await cmdNew(opts.positional[0], opts);
} else if (cmd === "migrate") {
  await cmdMigrate(argv[1]);
} else {
  const opts = parseArgs(argv);
  if (opts.help) { console.log(HELP); process.exit(0); }
  if (opts.version) {
    console.log(JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8")).version);
    process.exit(0);
  }
  await serve(opts);
}
