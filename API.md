# provludo — HTTP contract (internal)

All frontend code uses **relative URLs** so the same files work under any
base path. `B` below is the base: `/` in single-project mode, `/<name>/`
under `--root`.

## Shared assets (absolute, mode-independent)

| Route | File |
|---|---|
| `/__provludo/format.js` | `lib/format.js` (ESM, imported by browser) |
| `/__provludo/i18n.js` | `web/i18n.js` |
| `/__provludo/tour.js` | `web/tour.js` |
| `/__provludo/review.js` | `web/review.js` |

## Project mode (directory with `provludo.json`)

| Route | Serves |
|---|---|
| `B` | `web/wrapper.html` — slides ⇄ text toggle |
| `B`api/manifest | GET → `{name, lang, draftName, hasDeck}` |
| `B`text/` | `web/editor.html` |
| `B`text/api/draft | GET → `{content, mtime, name}`; PUT `{content, base_mtime}` → `{mtime}` or **409** with current state |
| `B`text/api/image | POST (body = image bytes, Content-Type image/*) → `{path}` (saved under draft dir `img/`) |
| `B`text/api/events | SSE: `draft-changed` (data: mtime) |
| `B`text/files/<rel> | files relative to the draft's directory (images) |
| `B`slides/ | deck `index.html` with `<script src="/__provludo/review.js">` injected before `</body>` |
| `B`slides/<asset> | other files from the deck's directory |
| `B`slides/api/review | GET → review state JSON (or `{}` if none); PUT `{state, markdown}` → writes `<deck-stem>.review.json` + `.review.md` |
| `B`slides/api/events | SSE: `deck-changed`, `review-changed` |

Editor requests `api/draft` etc. **relative** — resolved against `B`text/.
Overlay requests `api/review` **relative** — resolved against `B`slides/.
Both bases are always served with a trailing slash (redirect if missing).

## Degraded modes

- `provludo file.md` → editor at `/` (routes as `B`text/* but at root:
  `/api/draft`, `/api/image`, `/api/events`, `/files/…`). No wrapper.
- `provludo deck.html` → deck at `/` with overlay (routes `/api/review`,
  `/api/events`, deck assets at `/<asset>`). No wrapper.
- `--root DIR` → `/` = landing page listing projects (dirs containing
  `provludo.json`) and bare reveal.js decks (review-only); each mounted
  at `/<dirname>/` with the routes above (bare decks: slides side only).

## Conventions

- JSON responses `application/json; charset=utf-8`, `Cache-Control: no-store`.
- Writes are atomic (`.tmp` + rename).
- Conflict rule (PUT draft): if disk mtime − base_mtime > 1e-4 → 409 + state.
- SSE events carry the new `mtime` as data; clients refetch on mismatch.
- Review overlay with **no server** (static `<script>` include): all
  `api/review` calls fail → falls back to localStorage (key
  `provludo-review:<pathname>`), exports via panel.

## i18n

`web/i18n.js` exports `t(key)`, `setLang(l)`, `getLang()`. Resolution:
`?lang=` param → `localStorage("provludo-lang")` → `navigator.language`
(pl→pl, else en). UI strings only — file format markers are always English.
