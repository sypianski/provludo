# provludo

**Dress rehearsal for your slides.** A local, zero-dependency web tool
for the human↔AI loop of making presentations:

1. **Draft** — you shape the content as plain Markdown in a comfortable
   browser editor: drag slides and blocks around, leave inline
   suggestions for your AI agent.
2. **Generate** — your agent (Claude Code, or any agent that can read
   [`AGENT.md`](AGENT.md)) turns the draft into a real deck (reveal.js
   or anything else that renders to HTML).
3. **Review** — a review layer appears on top of the live deck:
   comment, fix wording in place, suspend slides.
4. **Merge** — the agent applies your review back to the Markdown source
   and regenerates. Repeat until it's ready for the actual stage.

*provludo* is Esperanto for **dress rehearsal** (*prov-* "trial" +
*ludo* "play").

![Drafting in provludo: select a phrase, leave a suggestion for the AI agent, autosaved to Markdown](https://raw.githubusercontent.com/sypianski/provludo/main/docs/suggestion.gif)

## Quick start

```bash
npx provludo new my-talk
```

That's it: a project directory appears, the server starts, the editor
opens, and a first-run tour shows you around. Then tell your AI agent:

> Read my-talk/AGENT.md and generate the deck from my-talk/draft.md.

When the deck exists, the same page grows a **slides ⇄ text** toggle:
review the live deck on one side, edit the draft on the other.

## What it looks like

The deck your agent generates from the draft — an ordinary reveal.js
presentation, with the review layer riding quietly in the corner:

![The generated reveal.js deck advancing through slides](https://raw.githubusercontent.com/sypianski/provludo/main/docs/deck.gif)

Reviewing the generated deck — comment on a selected fragment, right on
the live slides; everything lands in a change queue for the agent:

![Review layer on a live reveal.js deck: suggestion modal for a selected fragment](https://raw.githubusercontent.com/sypianski/provludo/main/docs/review.png)

The draft editor with the table of contents, a suspended slide and an
appendix slide; a first-run tour explains the controls:

![First-run tour spotlighting the slide bar in the draft editor](https://raw.githubusercontent.com/sypianski/provludo/main/docs/tour.png)

## Running it

| | |
|---|---|
| `npx provludo new <name>` | bootstrap a project + serve + open browser |
| `npx provludo` | serve the project in the current directory |
| `npx provludo draft.md` | just the draft editor, no project |
| `npx provludo deck.html` | just the review layer over an existing deck |
| `npx provludo --root ~/decks` | serve every project/deck under a directory |
| `npx provludo migrate old.md` | upgrade legacy (slaydilo) drafts |

Options: `--port`, `--host` (default `127.0.0.1`), `--tailnet` (bind to
your Tailscale IP and print the MagicDNS URL), `--no-open`.

Everything is stored in **plain files** in your project — the draft, the
review queue, the deck. No database, no accounts, no cloud. With no
server at all (deck hosted statically), the review layer still works by
including `web/review.js` as a `<script>` — state falls back to
localStorage and you export the review by hand.

## The draft format

Plain Markdown plus a handful of HTML-comment conventions — slides
separated by `---`, `<!-- suggestion: … -->` notes for the agent,
`<!-- suspended -->` and `<!-- appendix -->` slide markers, and a
`<!-- style: … -->` block at the top for global look-and-feel
directives. The full specification lives in [`AGENT.md`](AGENT.md) —
which is also literally the file your AI agent reads.

## Works with any agent

provludo has no API keys and calls no models. The AI side of the loop is
whatever agent you already use — it only needs to read and write files.
Every project ships with [`AGENT.md`](AGENT.md), the complete contract:
the format, the merge cycle, the rules. A reference integration for
Claude Code is in [`integrations/claude/`](integrations/claude/).

## UI languages

English and Polish (auto-detected, `?lang=en|pl` to switch). The file
format itself is always English — it's the API between you and your
agent.

## License

MIT.
