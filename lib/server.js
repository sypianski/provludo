/* provludo HTTP server — zero-dependency (node:http).
 * Implements the contract in API.md for all run modes:
 * project dir / bare draft.md / bare deck.html / --root multi-project. */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProject, loadRootEntry, scanRoot } from "./project.js";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(PKG, "web");

const SHARED_ASSETS = {
  "format.js": path.join(PKG, "lib", "format.js"),
  "i18n.js": path.join(WEB, "i18n.js"),
  "tour.js": path.join(WEB, "tour.js"),
  "review.js": path.join(WEB, "review.js"),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4",
  ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
};

const IMAGE_EXTS = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
  "image/webp": ".webp", "image/svg+xml": ".svg",
};

/* tour first, so window.provludoTour exists when the overlay initializes */
const INJECT_TAG = '<script src="/__provludo/tour.js"></script>\n'
                 + '<script src="/__provludo/review.js"></script>';
const MAX_BODY = 25 * 1024 * 1024;

/* ── small utilities ─────────────────────────────── */

function send(res, code, body, ctype = "application/json; charset=utf-8", extraHeaders = {}) {
  const data = Buffer.isBuffer(body) || typeof body === "string"
    ? body : JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": ctype,
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(data);
}

function redirect(res, to) {
  res.writeHead(302, { Location: to, "Cache-Control": "no-store" });
  res.end();
}

function notFound(res) { send(res, 404, { error: "not found" }); }

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { code: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/* Lexical path validation: allows symlinked assets (no realpath check),
 * rejects traversal. Returns an absolute path under baseDir or null. */
function safeJoin(baseDir, rel) {
  const segs = [];
  for (const raw of rel.split("/")) {
    let seg;
    try { seg = decodeURIComponent(raw); } catch { return null; }
    if (seg === "" || seg === ".") continue;
    if (seg === ".." || seg.includes("/") || seg.includes("\\") || seg.includes("\0")) return null;
    segs.push(seg);
  }
  return path.join(baseDir, ...segs);
}

async function serveFile(res, filePath) {
  let data;
  try {
    data = await fsp.readFile(filePath);
  } catch {
    return notFound(res);
  }
  send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
}

async function atomicWrite(filePath, data) {
  const tmp = filePath + ".tmp";
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, filePath);
}

function mtimeOf(p) {
  try { return fs.statSync(p).mtimeMs / 1000; } catch { return 0; }
}

function injectOverlay(html) {
  if (html.includes("__provludoReview") || html.includes("/__provludo/review.js")) return html;
  if (html.includes("</body>")) return html.replace("</body>", INJECT_TAG + "\n</body>");
  return html + INJECT_TAG;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
}

/* ── SSE + file watching ─────────────────────────── */

class ProjectWatch {
  constructor(project) {
    this.project = project;
    this.clients = { draft: new Set(), slides: new Set() };
    this.watchers = [];
    this.debounce = new Map();
    const dirs = new Set([project.draftDir, project.deckDir].filter(Boolean));
    for (const dir of dirs) {
      try {
        const w = fs.watch(dir, (_type, filename) => this.onChange(dir, filename));
        this.watchers.push(w);
      } catch { /* dir may not exist yet */ }
    }
  }

  onChange(dir, filename) {
    if (!filename) return;
    const full = path.join(dir, filename);
    const p = this.project;
    let channel, event, file;
    if (p.draftPath && full === p.draftPath) [channel, event, file] = ["draft", "draft-changed", p.draftPath];
    else if (p.deckPath && full === p.deckPath) [channel, event, file] = ["slides", "deck-changed", p.deckPath];
    else if (p.reviewJsonPath && full === p.reviewJsonPath) [channel, event, file] = ["slides", "review-changed", p.reviewJsonPath];
    else return;
    /* debounce per file: editors + atomic renames fire several events */
    clearTimeout(this.debounce.get(full));
    this.debounce.set(full, setTimeout(() => {
      this.debounce.delete(full);
      this.broadcast(channel, event, String(mtimeOf(file)));
    }, 120));
  }

  broadcast(channel, event, data) {
    for (const res of this.clients[channel]) {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    }
  }

  addClient(channel, res) {
    this.clients[channel].add(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("retry: 3000\n\n");
    const ping = setInterval(() => res.write(": ping\n\n"), 30000);
    res.on("close", () => { clearInterval(ping); this.clients[channel].delete(res); });
  }
}

/* ── request handling per project ────────────────── */

function draftState(project) {
  const p = project.draftPath;
  let content = "";
  try { content = fs.readFileSync(p, "utf8"); } catch { /* not created yet */ }
  return { content, mtime: mtimeOf(p), name: path.basename(p) };
}

async function handleDraftApi(req, res, project, rest, watch) {
  if (!project.draftPath) return notFound(res);
  if (rest === "api/draft" && req.method === "GET") {
    return send(res, 200, draftState(project));
  }
  if (rest === "api/draft" && req.method === "PUT") {
    const payload = JSON.parse((await readBody(req)).toString("utf8"));
    const baseMtime = Number(payload.base_mtime || 0);
    const diskMtime = mtimeOf(project.draftPath);
    if (diskMtime - baseMtime > 1e-4) return send(res, 409, draftState(project));
    await atomicWrite(project.draftPath, payload.content);
    return send(res, 200, { mtime: mtimeOf(project.draftPath) });
  }
  if (rest === "api/image" && req.method === "POST") {
    const ctype = (req.headers["content-type"] || "").split(";")[0].trim();
    const ext = IMAGE_EXTS[ctype];
    if (!ext) return send(res, 415, { error: `unsupported image type: ${ctype}` });
    const data = await readBody(req);
    const imgDir = path.join(project.draftDir, "img");
    await fsp.mkdir(imgDir, { recursive: true });
    let n = 1;
    while (fs.existsSync(path.join(imgDir, `pasted-${n}${ext}`))) n++;
    const target = path.join(imgDir, `pasted-${n}${ext}`);
    await fsp.writeFile(target, data);
    return send(res, 200, { path: `img/${path.basename(target)}` });
  }
  if (rest === "api/events" && req.method === "GET") {
    return watch.addClient("draft", res);
  }
  if (rest.startsWith("files/") && req.method === "GET") {
    const target = safeJoin(project.draftDir, rest.slice("files/".length));
    if (!target) return send(res, 403, { error: "path outside draft directory" });
    return serveFile(res, target);
  }
  return notFound(res);
}

async function handleSlidesApi(req, res, project, rest, watch) {
  if (!project.deckPath) return notFound(res);
  if (rest === "api/review" && req.method === "GET") {
    try {
      return send(res, 200, await fsp.readFile(project.reviewJsonPath), "application/json; charset=utf-8");
    } catch {
      return send(res, 200, {});
    }
  }
  if (rest === "api/review" && req.method === "PUT") {
    const payload = JSON.parse((await readBody(req)).toString("utf8"));
    await atomicWrite(project.reviewJsonPath, JSON.stringify(payload.state ?? {}, null, 2));
    if (typeof payload.markdown === "string") {
      await atomicWrite(project.reviewMdPath, payload.markdown);
    }
    return send(res, 200, { ok: true, mtime: mtimeOf(project.reviewJsonPath) });
  }
  if (rest === "api/events" && req.method === "GET") {
    return watch.addClient("slides", res);
  }
  if (req.method === "GET" || req.method === "HEAD") {
    if (rest === "" || rest === path.basename(project.deckPath)) {
      let html;
      try { html = await fsp.readFile(project.deckPath, "utf8"); } catch { return notFound(res); }
      return send(res, 200, injectOverlay(html), "text/html; charset=utf-8");
    }
    const target = safeJoin(project.deckDir, rest);
    if (!target) return send(res, 403, { error: "path outside deck directory" });
    return serveFile(res, target);
  }
  return notFound(res);
}

function manifestInfo(project) {
  return {
    name: project.name,
    lang: project.lang,
    draftName: project.draftPath ? path.basename(project.draftPath) : null,
    hasDeck: !!(project.deckPath && fs.existsSync(project.deckPath)),
    hasDraft: !!project.draftPath,
    mode: project.mode,
  };
}

async function handleProject(req, res, project, base, rest, watch) {
  if (rest === "api/manifest") return send(res, 200, manifestInfo(project));

  if (project.mode === "draft") {
    if (rest === "") return serveFile(res, path.join(WEB, "editor.html"));
    return handleDraftApi(req, res, project, rest, watch);
  }
  if (project.mode === "deck") {
    return handleSlidesApi(req, res, project, rest, watch);
  }

  /* full project mode */
  if (rest === "") return serveFile(res, path.join(WEB, "wrapper.html"));
  if (rest === "text") return redirect(res, base + "text/");
  if (rest === "slides") return redirect(res, base + "slides/");
  if (rest === "text/") return serveFile(res, path.join(WEB, "editor.html"));
  if (rest.startsWith("text/")) {
    return handleDraftApi(req, res, project, rest.slice("text/".length), watch);
  }
  if (rest.startsWith("slides/")) {
    return handleSlidesApi(req, res, project, rest.slice("slides/".length), watch);
  }
  return notFound(res);
}

/* ── landing page (--root) ───────────────────────── */

function landingHtml(entries) {
  const items = entries.map(e =>
    `<li><a href="/${encodeURIComponent(e.name)}/">${escapeHtml(e.name)}</a>` +
    (e.kind === "deck" ? ' <span class="kind">deck only</span>' : "") + "</li>").join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>provludo</title>
<style>
  body { font-family: Georgia, serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem;
         background: #faf7f1; color: #2b2620; }
  @media (prefers-color-scheme: dark) { body { background: #211e1a; color: #e8e2d6; } }
  h1 { font-size: 1.4rem; letter-spacing: .03em; }
  ul { list-style: none; padding: 0; } li { margin: .4em 0; }
  a { color: inherit; } .kind { opacity: .55; font-size: .8em; }
</style></head><body>
<h1>provludo</h1>
<ul>${items || "<li><em>nothing found</em></li>"}</ul>
</body></html>`;
}

/* ── server factory ──────────────────────────────── */

/* opts: { mode: "project"|"draft"|"deck"|"root", target, root, host, port } */
export function createServer(opts) {
  const watches = new Map();   // key: project.dir + mode
  const watchFor = (project) => {
    const key = project.mode + ":" + project.dir;
    if (!watches.has(key)) watches.set(key, new ProjectWatch(project));
    return watches.get(key);
  };

  const server = http.createServer(async (req, res) => {
    try {
      const p = decodeURI((req.url || "/").split("?")[0]);

      if (p.startsWith("/__provludo/")) {
        const asset = SHARED_ASSETS[p.slice("/__provludo/".length)];
        return asset ? await serveFile(res, asset) : notFound(res);
      }

      if (opts.mode === "root") {
        if (p === "/") return send(res, 200, landingHtml(scanRoot(opts.root)), "text/html; charset=utf-8");
        const segs = p.split("/").filter(Boolean);
        const project = loadRootEntry(opts.root, segs[0]);
        if (!project) return notFound(res);
        const base = "/" + segs[0] + "/";
        if (segs.length === 1 && !p.endsWith("/")) return redirect(res, base);
        const rest = p.slice(base.length);
        return await handleProject(req, res, project, base, rest, watchFor(project));
      }

      let project;
      if (opts.mode === "project") project = loadProject(opts.target);
      else project = opts.project;   // draft/deck: descriptor passed in
      const rest = p.replace(/^\/+/, "");
      return await handleProject(req, res, project, "/", rest, watchFor(project));
    } catch (e) {
      const code = e.code === 413 ? 413 : 500;
      try { send(res, code, { error: String(e.message || e) }); } catch { /* headers sent */ }
    }
  });

  return server;
}
