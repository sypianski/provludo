# provludo

**Dress rehearsal for your slides.** A local, zero-dependency web tool
for the human↔AI loop of making presentations — really two tools in
one, wrapped around whatever AI agent you already use.

**The drafting problem** is older than AI agents. If you've ever
written a deck in Markdown for Deckset, Marp or reveal.js, you know
that restructuring one long file means endless scrolling and
copy-pasting slides around. provludo's draft editor shows the deck as
a column of slides: drag a slide — or a single block — somewhere else,
or just type its new position; suspend slides instead of deleting
them; attach suggestions to any paragraph. The file on disk stays
plain Markdown the whole time.

**The review problem.** If you make slides with an AI agent, you know
the shuttle: look at the deck in the browser, switch to the chat,
describe what to change — which slide, which bullet, what to cut, how
to rephrase — wait, refresh, repeat. provludo puts the feedback where
the slides are: it overlays a review layer on the **live
presentation** ([reveal.js](https://revealjs.com/), the open-source
HTML presentation framework, is the best-supported target). Select a
fragment and leave a comment, fix wording in place, mark a section for
deletion, suspend a whole slide. Your remarks pile up in a change
queue; you tell the agent to apply the review, it edits the Markdown
source and regenerates, you refresh the browser. No describing, no
"on slide 7, third bullet".

Together they close the loop:

1. **Draft** — shape the content as Markdown in the browser editor.
2. **Generate** — your agent (Claude Code, or any agent that can read
   [`AGENT.md`](AGENT.md)) turns the draft into a real deck.
3. **Review** — annotate the live deck, right on the slides.
4. **Merge** — the agent applies your review to the source and
   regenerates. Repeat until it's ready for the actual stage.

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

**Prerequisites:** [Node.js](https://nodejs.org) ≥ 20 (`npx` ships with
it) and a browser. Nothing else — provludo has zero dependencies, no
accounts, no cloud.

**New to this kind of workflow?** provludo shines when you drive an
agentic coding tool — [Claude Code](https://claude.com/claude-code),
[OpenAI Codex](https://openai.com/codex/), or a free one: Google's
open-source [Gemini CLI](https://github.com/google-gemini/gemini-cli)
(generous no-cost quota), or [OpenCode](https://github.com/sst/opencode)
and [Aider](https://aider.chat), which work with any model, including
local ones. Anything that can run commands and edit files will do.
Then the whole setup is one prompt:

> Run `npx provludo new my-talk`, tell me the URL it prints, then read
> `my-talk/AGENT.md` and draft a presentation about ⟨your topic⟩.

The agent scaffolds the project and follows the contract; you take over
in the browser. No cloning, no manual install — `npx` fetches provludo
straight from npm.

## What it looks like

Reviewing the generated deck, right on the live slides — select a
fragment and comment, suspend a slide, then peek at the change queue
your agent will read:

![Review layer on a live reveal.js deck: comment on a fragment, suspend a slide, export panel with the Markdown change queue](https://raw.githubusercontent.com/sypianski/provludo/main/docs/review.gif)

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
