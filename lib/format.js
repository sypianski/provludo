/* provludo draft format v2 — the single implementation of the format.
 *
 * Shared verbatim between the Node server (import) and the browser
 * (served at /__provludo/format.js). Keep it dependency-free and
 * environment-agnostic: no node:* imports, no DOM access.
 *
 * Reading is lenient: v1 (Polish, slaydilo-era) markers are accepted.
 * Writing always emits v2 (English) markers — serializeDraft() is the
 * only writer, so `parse + serialize` doubles as the v1→v2 migration.
 */

export const FORMAT_VERSION = 2;

/* ── markers ──────────────────────────────────────── */
const RE_SEP = /^-{3,}$/;
const RE_SUG = /^<!--\s*(?:suggestion|sugestia)(?:\s*@\s*"([^"]*)")?\s*:\s*([\s\S]*?)\s*-->$/;
const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const RE_STYLE = /(?:^|\n)<!--\s*(?:style|styl):?[ \t]*\n?([\s\S]*?)\n?-->[ \t]*\n?/;
const RE_SUSP = /^<!--\s*(?:suspended|zawieszony)\s*-->$/;
const RE_APP = /^<!--\s*(?:appendix|dodatkowe|materia[łl]y-dodatkowe)\s*-->$/;

export const RE = { SEP: RE_SEP, SUG: RE_SUG, IMG: RE_IMG, STYLE: RE_STYLE, SUSP: RE_SUSP, APP: RE_APP };

/* Review-export line markers (used by the review overlay and read by
 * AI agents; documented in AGENT.md). v1 spellings listed for readers. */
export const REVIEW_MARKERS = {
  edit: "EDIT:",
  delete: "DELETE:",
  suspend: "SUSPEND THIS SLIDE",
  v1: { edit: "EDYCJA:", delete: "USUŃ:", suspend: "ZAWIEŚ TEN SLAJD" },
};

/* ── block model ──────────────────────────────────── */
export function blockKind(text) {
  const t = text.trim();
  if (RE_IMG.test(t)) return "image";
  const lines = t.split("\n");
  if (lines.length >= 2 && lines[0].includes("|")
      && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1]) && lines[1].includes("-")) return "table";
  if (/^#\s/.test(t)) return "h1";
  if (/^##+\s/.test(t)) return "h2";
  return "text";
}

export function makeBlock(text) {
  return { type: blockKind(text) === "image" ? "image" : "text", text, comments: [] };
}

/* ── parse ────────────────────────────────────────── */
export function parseDraft(text) {
  const ms = text.match(RE_STYLE);
  const style = ms ? ms[1].trim() : "";
  if (ms) text = text.replace(RE_STYLE, "\n");
  const slides = [];
  let cur = { blocks: [], comments: [] };
  let buf = [];
  const flush = () => {
    const t = buf.join("\n").trim();
    buf = [];
    if (t) cur.blocks.push(makeBlock(t));
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const lt = line.trim();
    if (RE_SEP.test(lt)) {
      flush(); slides.push(cur); cur = { blocks: [], comments: [] };
    } else if (RE_SUSP.test(lt)) {
      flush(); cur.suspended = true;
    } else if (RE_APP.test(lt)) {
      flush(); cur.appendix = true;
    } else if (RE_SUG.test(lt)) {
      flush();
      const m = lt.match(RE_SUG);
      const c = { quote: m[1] || "", text: m[2] || "" };
      (cur.blocks.length ? cur.blocks[cur.blocks.length - 1].comments : cur.comments).push(c);
    } else if (lt === "") {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush(); slides.push(cur);
  while (slides.length > 1 && !slides[slides.length - 1].blocks.length
         && !slides[slides.length - 1].comments.length) slides.pop();
  while (slides.length > 1 && !slides[0].blocks.length && !slides[0].comments.length) slides.shift();
  return { slides, style };
}

/* ── serialize (always v2/EN) ─────────────────────── */
export function fmtSuggestion(c) {
  const body = (c.text || "").replace(/\n+/g, " ").trim();
  const quote = (c.quote || "").replace(/"/g, "'").replace(/\n+/g, " ").trim();
  return quote ? `<!-- suggestion @ "${quote}": ${body} -->`
               : `<!-- suggestion: ${body} -->`;
}

export function serializeDraft(slides, style) {
  const header = (style || "").trim()
    ? `<!-- style:\n${style.trim().replace(/-->/g, "->")}\n-->\n\n` : "";
  return header + slides.map(s => {
    const parts = [];
    if (s.suspended) parts.push("<!-- suspended -->");
    if (s.appendix) parts.push("<!-- appendix -->");
    parts.push(...s.comments.map(fmtSuggestion));
    for (const b of s.blocks) {
      let chunk = b.text.replace(/\n+$/, "");
      for (const c of b.comments) chunk += "\n" + fmtSuggestion(c);
      parts.push(chunk);
    }
    return parts.join("\n\n");
  }).join("\n\n---\n\n") + "\n";
}

/* ── migration v1 → v2 ────────────────────────────── */
/* parse() reads both marker generations; serialize() emits v2 only —
 * so migration is a canonicalizing round-trip. Whitespace between
 * blocks is normalized as a side effect. */
export function migrateDraft(text) {
  const { slides, style } = parseDraft(text);
  return serializeDraft(slides, style);
}

/* First heading (or leading text) of a slide — used for TOC labels and
 * as the locator agents use to find a slide back in the draft. */
export function slideLabel(slide, emptyLabel = "(empty slide)") {
  for (const b of slide.blocks) {
    const k = blockKind(b.text);
    if (k === "h1" || k === "h2")
      return b.text.replace(/^#{1,6}\s+/, "").split("\n")[0].slice(0, 64);
  }
  for (const b of slide.blocks) {
    const t = b.text.trim();
    if (t) return t.replace(/^[-*]\s+/, "").split("\n")[0].slice(0, 64);
  }
  return emptyLabel;
}
