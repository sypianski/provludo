# provludo — contract for AI agents

You are the AI half of a human↔AI presentation loop. The human drafts and
reviews; **you generate the deck and merge feedback**. This file defines
the format and the rules. It ships inside every provludo project.

## The project

A provludo project is a directory with `provludo.json`:

```json
{ "name": "my-talk", "draft": "draft.md", "deck": "deck/index.html" }
```

- **`draft` is the canonical source.** Everything else is derived from it.
- `deck` is where you put the generated presentation (any HTML framework;
  reveal.js works best with the review layer). Missing deck = not
  generated yet.
- Review files live next to the deck: `<deck-stem>.review.json` (state),
  `<deck-stem>.review.md` (the change queue you read), and
  `<deck-stem>.review.archive.md` (append-only history of applied
  reviews, written by you — see the merge cycle below).

## Draft format

Plain Markdown plus five conventions:

1. **Slides are separated by `---`** on its own line, blank lines around
   it. Don't use setext headings (text + `---` underneath) — they'd parse
   as a slide boundary.
2. **A block** is a paragraph / heading / list / pipe table / image
   separated by blank lines. An image is a lone `![alt](path-or-url)`
   line; relative paths resolve against the draft's directory.
3. **Suggestions** are HTML comments addressed to you, placed directly
   under the block they concern (at the top of a slide = about the whole
   slide):

   ```markdown
   <!-- suggestion: cut this slide down to three bullets -->
   <!-- suggestion @ "quoted fragment": rephrase less technically -->
   ```

   **When generating the deck: act on suggestions and do not carry them
   into the output.** When merely editing the draft: remove the
   suggestions you fulfilled, keep the rest.
4. **Style directives** (optional) are a multi-line comment at the very
   top of the file — global instructions for the generation stage:

   ```markdown
   <!-- style:
   reveal.js, dark background, serif type, minimal text per slide
   -->
   ```
5. **Slide markers**, first line of a slide:
   - `<!-- suspended -->` — keep the slide in the draft as an archive,
     but **skip it when generating**. Never delete slides from the draft;
     suspend them instead (it's reversible).
   - `<!-- appendix -->` — include the slide, but **move it to the very
     end** of the generated deck, into a backup/appendix section.
     Relative order of appendix slides = their order in the source.

(Legacy drafts may use Polish markers — `sugestia`, `styl`, `zawieszony`,
`dodatkowe`, `EDYCJA:`, `USUŃ:`, `ZAWIEŚ TEN SLAJD`; read them the same
way. `provludo migrate <file>` rewrites them.)

## The merge cycle

The human reviews the live deck in the browser; their remarks accumulate
in `<deck-stem>.review.md`. It is a **queue, not an archive**. Entries:

| Marker | Meaning |
|---|---|
| `<!-- suggestion: … -->` / `<!-- suggestion @ "…": … -->` | comment on the slide / a fragment |
| `EDIT: «old» → «new»` | wording fixed in place — apply to the draft |
| `DELETE: «text»` | remove this section from the slide |
| `SUSPEND THIS SLIDE` | add `<!-- suspended -->` to this slide in the draft |
| `DELETE THIS SLIDE` | the human explicitly wants it gone — still prefer suspending unless clearly told otherwise |
| `TO APPENDIX (move to the end)` | add `<!-- appendix -->` to this slide |

A trailing ` — <name>` on any entry is reviewer attribution.

Entries are grouped under `## Slide N — "locator"` headings. **Locate
slides by the locator text (heading or leading words), not by number** —
numbers shift between regenerations.

When asked to apply the review:

1. **Snapshot commit** (skip if not a git repo). Stage the draft, deck,
   `<deck-stem>.review.md`, `<deck-stem>.review.json`, and
   `<deck-stem>.review.archive.md` (if it exists), then
   `git commit -m "chore(provludo): snapshot before applying review"`.
   This gives a clean rollback point before you touch anything.
2. **Archive the queue.** Prepend the current contents of
   `<deck-stem>.review.md` to `<deck-stem>.review.archive.md` under a
   heading `## <YYYY-MM-DD HH:MM>` (append `  ·  before <snapshot-sha>`
   if you made the snapshot commit in step 1). Create the archive file
   if it does not yet exist.
3. Read `<deck-stem>.review.md`; apply every entry to the **draft**.
4. Regenerate the deck from the updated draft.
5. **Clear the queue**: overwrite `<deck-stem>.review.json` with
   `{"_resetAt": <current unix seconds>}` and `<deck-stem>.review.md`
   with an empty review (just the heading). The browser overlay watches
   these files and resets itself.
6. **Apply commit** (skip if not a git repo).
   `git commit -am "provludo: apply review — <one-line summary>"`.

## Rules

- Never edit the generated deck by hand except as step 2 above — the
  draft is the source of truth.
- Never delete content from the draft on your own initiative; suspend.
- Don't renumber or reorder slides while merging unless an entry asks.
- The file format (markers above) is always English, regardless of the
  content language or the UI language the human uses.
- **Single reviewer per deck.** provludo assumes one human reviews a
  given deck. Reviewer attribution (`— <name>` on entries) is supported
  but optional. If several people share a draft, coordinate merges
  manually — the tool does not resolve concurrent review queues.
