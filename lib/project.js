/* Project model: resolves a target (dir/file) into a normalized project
 * descriptor the server can route against. See SPEC.md §3 and API.md. */
import fs from "node:fs";
import path from "node:path";

export const MANIFEST_NAME = "provludo.json";

/* A project descriptor:
 * { name, dir, lang,
 *   draftPath|null, draftDir,
 *   deckPath|null, deckDir, reviewJsonPath, reviewMdPath,
 *   mode: "project" | "draft" | "deck" }
 */

export function loadProject(dir) {
  const manifestPath = path.join(dir, MANIFEST_NAME);
  const raw = fs.readFileSync(manifestPath, "utf8");
  let m;
  try {
    m = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${manifestPath}: invalid JSON (${e.message})`);
  }
  const draftPath = m.draft ? path.resolve(dir, m.draft) : null;
  const deckPath = m.deck ? path.resolve(dir, m.deck) : null;
  const reviewMdPath = m.review
    ? path.resolve(dir, m.review)
    : deckPath ? deckStemPath(deckPath, ".review.md") : null;
  return {
    mode: "project",
    name: m.name || path.basename(dir),
    lang: m.lang || null,
    dir,
    draftPath,
    draftDir: draftPath ? path.dirname(draftPath) : null,
    deckPath,
    deckDir: deckPath ? path.dirname(deckPath) : null,
    reviewMdPath,
    reviewJsonPath: reviewMdPath ? reviewMdPath.replace(/\.md$/, ".json") : null,
  };
}

/* deck/index.html → deck/index.review.md etc. */
function deckStemPath(deckPath, suffix) {
  const dir = path.dirname(deckPath);
  const stem = path.basename(deckPath).replace(/\.html?$/i, "");
  return path.join(dir, stem + suffix);
}

export function draftOnlyProject(mdPath) {
  const p = path.resolve(mdPath);
  return {
    mode: "draft",
    name: path.basename(p),
    lang: null,
    dir: path.dirname(p),
    draftPath: p,
    draftDir: path.dirname(p),
    deckPath: null, deckDir: null, reviewMdPath: null, reviewJsonPath: null,
  };
}

export function deckOnlyProject(htmlPath) {
  const p = path.resolve(htmlPath);
  return {
    mode: "deck",
    name: path.basename(path.dirname(p)) + "/" + path.basename(p),
    lang: null,
    dir: path.dirname(p),
    draftPath: null, draftDir: null,
    deckPath: p,
    deckDir: path.dirname(p),
    reviewMdPath: deckStemPath(p, ".review.md"),
    reviewJsonPath: deckStemPath(p, ".review.json"),
  };
}

export function looksLikeDeck(indexHtml) {
  try {
    const txt = fs.readFileSync(indexHtml, "utf8");
    return txt.includes('class="reveal"') || txt.includes("reveal.js");
  } catch {
    return false;
  }
}

/* --root: enumerate mountable entries (projects and bare decks). */
export function scanRoot(root) {
  const entries = [];
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith(".")) continue;
    const dir = path.join(root, name);
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch { continue; }
    if (fs.existsSync(path.join(dir, MANIFEST_NAME))) {
      entries.push({ name, kind: "project" });
    } else if (looksLikeDeck(path.join(dir, "index.html"))) {
      entries.push({ name, kind: "deck" });
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/* Resolve one --root entry into a project descriptor (or null). */
export function loadRootEntry(root, name) {
  if (name.includes("/") || name.includes("\\") || name.startsWith(".")) return null;
  const dir = path.join(root, name);
  try {
    if (fs.existsSync(path.join(dir, MANIFEST_NAME))) return loadProject(dir);
    const index = path.join(dir, "index.html");
    if (looksLikeDeck(index)) return deckOnlyProject(index);
  } catch { /* fall through */ }
  return null;
}
