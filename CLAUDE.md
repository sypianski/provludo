# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

provludo is a local, zero-dependency web tool for a human↔AI presentation loop: the human drafts slides as Markdown in a browser editor and reviews the generated deck through an overlay; an AI agent (any agent that can read/write files) generates the deck and merges the review back into the draft. No API keys, no model calls — the agent side is external.

## Commands

- Tests: `node --test` (runs `test/`). Single file: `node --test test/format.test.js`. Single test: `node --test --test-name-pattern "round-trip" test/format.test.js`.
  - `npm test` is defined as `node --test test/`, which fails on this machine's Node 22 (directory argument rejected) — use bare `node --test` instead.
- Run from source: `node bin/provludo.js [new <name> | <path> | --root <dir> | migrate <file.md>]`. Default port 8765 (walks to a free port unless `--port` is explicit); `--tailnet` binds the Tailscale IP (`lib/tailnet.js`).
- No build step, no lint, no dependencies: `node:` builtins only, ESM, Node ≥20.

## The two contracts (read before changing behavior)

- **`AGENT.md`** — the draft format and merge-cycle contract. It is simultaneously project documentation *and* the literal file AI agents read: `provludo new` copies it into every created project. Any change to format or merge semantics must land consistently in `AGENT.md`, `lib/format.js`, and `integrations/claude/SKILL.md` (the reference Claude Code skill).
- **`API.md`** — the HTTP contract that `lib/server.js` implements. All frontend code uses relative URLs so the same files work under any base path (`/` in single-project mode, `/<name>/` under `--root`). Keep `API.md` in sync with server changes.

## Architecture

`bin/provludo.js` (CLI) resolves its target into one of four modes — `project` (dir with `provludo.json`), `draft` (bare `.md`), `deck` (bare `.html`), `root` (multi-project landing page) — as a project descriptor built by `lib/project.js`; `lib/server.js` routes purely off that descriptor. The browser side: `web/wrapper.html` (slides ⇄ text toggle over two iframes), `web/editor.html` (the whole draft editor, one file), `web/review.js` (overlay injected into the deck HTML before `</body>`), `web/tour.js` + `web/i18n.js` (shared assets under `/__provludo/`).

Key invariants:

- **The draft (`draft.md`) is the canonical source**; the deck and the review files are derived from it. The server never generates the deck — that is the external agent's job.
- **`lib/format.js` is the single implementation of the draft format**, imported by Node and served verbatim to the browser at `/__provludo/format.js`. It must stay environment-agnostic: no `node:*` imports, no DOM. `parseDraft()` leniently reads legacy v1 (Polish, slaydilo-era) markers; `serializeDraft()` is the only writer and always emits v2 (English) — so parse+serialize *is* the migration (`provludo migrate`).
- **`web/review.js` is deliberately a self-contained classic script** (no ESM imports, its own inline i18n dict): it must also work as a static `<script>` include on a deck with no server at all, falling back to localStorage. Don't refactor it to import `i18n.js` or `format.js`.
- State flows through plain files + SSE: writes are atomic (`.tmp` + rename), draft PUT returns 409 on mtime mismatch, `fs.watch` broadcasts `draft-changed` / `deck-changed` / `review-changed` (debounced per file) and clients refetch.
- Review-queue reset protocol: after merging, the agent overwrites `<deck-stem>.review.json` with `{"_resetAt": <unix seconds>}`; the browser overlay watches for this and resets itself.

## Conventions

- UI strings are EN/PL via `web/i18n.js` (`?lang=` → localStorage → `navigator.language`); **file-format markers are always English**, regardless of UI or content language.
- The npm tarball ships only the `files` allowlist in `package.json` — a new top-level directory must be added there or it won't be published.
- `templates/draft.md` is the starter draft copied by `provludo new` and by `provludo <missing>.md`.
