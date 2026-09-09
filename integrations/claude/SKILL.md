---
name: provludo
description: >-
  Drives the provludo presentation loop: draft slides in Markdown for the
  user to edit in the browser, generate the deck from the draft, and merge
  the user's review back into the source. Use when the user asks to draft
  a presentation, "start provludo", generate a deck from a provludo draft,
  or apply/merge a deck review (mentions of draft.md, provludo.json,
  *.review.md).
---

# provludo — presentation loop

Read the project's `AGENT.md` first — it is the complete contract (draft
format, merge cycle, rules). This skill only adds the operational steps.

## Starting a project

```bash
npx provludo new <name> --no-open     # or: provludo, if installed globally
```

Print the URL for the user (add `--tailnet` when they want to open it
from another device). Run the server in the background; it watches files,
so your later edits appear in the user's browser automatically.

## Stage 1 — drafting

Write/edit `draft.md` with ordinary file edits, following the format in
`AGENT.md`. The user rearranges and annotates in the browser; the file on
disk is always current (autosave).

## Stage 2 — generating

When asked to generate: read `draft.md`, honor `<!-- style: … -->` and
all `<!-- suggestion -->` notes (act on them, don't copy them into the
output), skip `<!-- suspended -->` slides, move `<!-- appendix -->`
slides to the end. Write the deck where `provludo.json` points
(`deck/index.html` by default). reveal.js is the best-supported target.

## Stage 3 — merging a review

When asked to apply the review: follow the merge cycle in `AGENT.md`
(apply `<deck-stem>.review.md` to the draft → regenerate the deck →
clear the queue by writing `{"_resetAt": <unix seconds>}` to
`<deck-stem>.review.json` and an empty review to the `.md`).
