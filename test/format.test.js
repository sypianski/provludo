import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDraft, serializeDraft, migrateDraft, blockKind, slideLabel } from "../lib/format.js";

const V2 = `<!-- style:
reveal.js, dark background, big serif type
-->

# Title slide

Intro paragraph.
<!-- suggestion: make this punchier -->

---

<!-- suspended -->

## Old idea

---

<!-- appendix -->
<!-- suggestion: whole-slide note -->

## Extra material

| A | B |
| --- | --- |
| 1 | 2 |

![diagram](img/d.png)
<!-- suggestion @ "diagram": redraw in higher contrast -->
`;

test("parses v2 draft: style, slides, blocks, comments", () => {
  const { slides, style } = parseDraft(V2);
  assert.equal(style, "reveal.js, dark background, big serif type");
  assert.equal(slides.length, 3);
  assert.equal(slides[0].blocks.length, 2);
  assert.equal(slides[0].blocks[1].comments[0].text, "make this punchier");
  assert.equal(slides[1].suspended, true);
  assert.equal(slides[2].appendix, true);
  assert.equal(slides[2].comments[0].text, "whole-slide note");   // slide-level
  const img = slides[2].blocks.at(-1);
  assert.equal(img.type, "image");
  assert.equal(img.comments[0].quote, "diagram");
});

test("round-trip v2 is stable", () => {
  const p1 = parseDraft(V2);
  const once = serializeDraft(p1.slides, p1.style);
  const p2 = parseDraft(once);
  const twice = serializeDraft(p2.slides, p2.style);
  assert.equal(once, twice);
});

const V1 = `<!-- styl:
reveal.js, ciemne tło
-->

# Tytuł
<!-- sugestia: skróć -->

---

<!-- zawieszony -->

Stary slajd

---

<!-- dodatkowe -->

Zapasowy
<!-- sugestia @ "Zapasowy": przeformułuj -->
`;

test("reads v1 (Polish) markers", () => {
  const { slides, style } = parseDraft(V1);
  assert.equal(style, "reveal.js, ciemne tło");
  assert.equal(slides[1].suspended, true);
  assert.equal(slides[2].appendix, true);
  assert.equal(slides[0].blocks[0].comments[0].text, "skróć");
  assert.equal(slides[2].blocks[0].comments[0].quote, "Zapasowy");
});

test("migrateDraft rewrites v1 markers to v2", () => {
  const out = migrateDraft(V1);
  assert.match(out, /<!-- style:\n/);
  assert.match(out, /<!-- suspended -->/);
  assert.match(out, /<!-- appendix -->/);
  assert.match(out, /<!-- suggestion: skróć -->/);
  assert.match(out, /<!-- suggestion @ "Zapasowy": przeformułuj -->/);
  assert.doesNotMatch(out, /sugestia|zawieszony|dodatkowe|styl:/);
  // migration is idempotent
  assert.equal(migrateDraft(out), out);
});

test("blockKind classification", () => {
  assert.equal(blockKind("# Heading"), "h1");
  assert.equal(blockKind("## Sub"), "h2");
  assert.equal(blockKind("| a | b |\n| --- | --- |\n| 1 | 2 |"), "table");
  assert.equal(blockKind("![x](y.png)"), "image");
  assert.equal(blockKind("plain text"), "text");
});

test("slideLabel prefers headings, falls back to text", () => {
  const { slides } = parseDraft("intro\n\n# Real title\n\n---\n\n- bullet one\n");
  assert.equal(slideLabel(slides[0]), "Real title");
  assert.equal(slideLabel(slides[1]), "bullet one");
  assert.equal(slideLabel({ blocks: [] }, "(pusty)"), "(pusty)");
});

test("drops leading/trailing empty slides, keeps at least one", () => {
  const { slides } = parseDraft("---\n\nonly\n\n---\n");
  assert.equal(slides.length, 1);
  assert.equal(slides[0].blocks[0].text, "only");
  assert.equal(parseDraft("").slides.length, 1);
});
