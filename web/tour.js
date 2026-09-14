/* provludo first-run tour — zero-dep spotlight + bubble walkthrough.
 *
 * Written as a module-compatible classic script: works both as
 * `<script src>` (injected into decks alongside review.js) and via
 * dynamic import() from the editor. Sets window.provludoTour.
 * Self-contained on purpose (inline i18n) — must not depend on server
 * assets beyond itself. */
(() => {
  "use strict";
  if (window.provludoTour) return;

  /* ── i18n (inline, EN/PL) ─────────────────────── */
  let lang = "en";
  try {
    const s = localStorage.getItem("provludo-lang");
    lang = s || ((navigator.language || "en").toLowerCase().startsWith("pl") ? "pl" : "en");
  } catch {}
  if (lang !== "pl") lang = "en";

  const S = {
    en: {
      next: "Next", back: "Back", skip: "Skip tour", done: "Got it!",
      of: "of",
      editor: [
        [null, "Welcome to provludo", "This is your presentation <b>draft</b>: pure content, zero styling. You shape the text here; your AI agent turns it into a real deck later."],
        [null, "Two views: slides ⇄ text", "You are in the <b>text</b> view (the draft). The toggle at the top of the page switches to the <b>slides</b> view — the live deck your agent generated. It appears once the deck exists; edits live here in the draft."],
        [".slide-bar", "Slides", "Slides are separated by rules. Drag the ⠿ handle to reorder them; hover for controls — suspend ⏸ keeps a slide in the file but out of the deck, 📎 sends it to the appendix."],
        [".blk", "Blocks", "Each paragraph, list, table or image is a block. Click to edit raw Markdown, drag ⠿ to move it — even across slides. A blank line splits a block in two."],
        [".blk", "Suggestions", "Select any text (or use 💬) to attach a note for your AI agent — “make this punchier”, “split into two slides”. Notes live as comments in the file; the agent acts on them and removes them."],
        ["#stylebtn", "Style directives", "Global instructions for the final deck — framework, colors, fonts, tone. Not part of any slide."],
        ["#toc", "Table of contents", "Click to jump between slides. The current slide is highlighted as you scroll."],
        ["#status", "Autosave & live sync", "Everything saves automatically. When your AI agent edits the file on disk, the editor refreshes itself — you’ll never work on a stale copy."],
        ["#helpbtn", "That’s it", "Replay this tour anytime with the ? button. Draft away — then ask your agent to generate the deck."],
      ],
      review: [
        [null, "Review mode", "This is the <b>live deck</b> with a review layer on top. Whatever you note here becomes a change-list your AI agent applies back to the source draft."],
        [".pv-btn-comment", "Comment (c)", "Comment on the current slide — or select text first to comment on a fragment."],
        [".pv-btn-edit", "Edit in place (e)", "Fix wording directly on the slide; press again to save. In edit mode ✕ marks a section for deletion (click again to restore)."],
        [".pv-btn-suspend", "Suspend (Shift+Z)", "Mark the slide to be dropped from the next regeneration — it stays in the source as an archive."],
        [".pv-btn-panel", "Your review (r)", "Everything you noted, exported as Markdown for the agent. With a server it saves to a file automatically; set your name here if several people review."],
      ],
    },
    pl: {
      next: "Dalej", back: "Wstecz", skip: "Pomiń", done: "Jasne!",
      of: "z",
      editor: [
        [null, "Witaj w provludo", "To <b>szkic</b> prezentacji: czysta treść, zero stylistyki. Tu nadajesz kształt tekstowi; agent AI zamieni go później w prawdziwy deck."],
        [null, "Dwa widoki: slajdy ⇄ tekst", "Jesteś w widoku <b>tekst</b> (szkic). Przełącznik u góry strony przeskakuje na widok <b>slajdów</b> — żywy deck wygenerowany przez agenta. Pojawia się, gdy deck powstanie; edytujesz zawsze tutaj, w szkicu."],
        [".slide-bar", "Slajdy", "Slajdy oddzielają kreski. Przeciągnij uchwyt ⠿, by zmienić kolejność; po najechaniu masz kontrolki — ⏸ zawiesza slajd (zostaje w pliku, wypada z decka), 📎 wysyła go do materiałów dodatkowych."],
        [".blk", "Bloki", "Każdy akapit, lista, tabelka czy obrazek to blok. Kliknij, by edytować surowy Markdown; przeciągnij ⠿, by przenieść — także między slajdami. Pusta linia dzieli blok na dwa."],
        [".blk", "Sugestie", "Zaznacz tekst (albo użyj 💬), by dopisać notatkę dla agenta AI — „skróć”, „rozbij na dwa slajdy”. Notatki żyją jako komentarze w pliku; agent je wykonuje i usuwa."],
        ["#stylebtn", "Wytyczne stylu", "Globalne instrukcje dla finalnej prezentacji — framework, kolory, fonty, ton. Nie są częścią żadnego slajdu."],
        ["#toc", "Spis slajdów", "Klikaj, by skakać między slajdami. Bieżący podświetla się przy przewijaniu."],
        ["#status", "Autozapis i synchronizacja", "Wszystko zapisuje się samo. Gdy agent AI zmieni plik na dysku, edytor sam się odświeży — nigdy nie pracujesz na nieaktualnej kopii."],
        ["#helpbtn", "To wszystko", "Ten instruktaż odpalisz ponownie przyciskiem ?. Szkicuj — a potem poproś agenta o wygenerowanie decka."],
      ],
      review: [
        [null, "Tryb recenzji", "To <b>żywy deck</b> z nałożoną warstwą recenzji. Wszystko, co tu zanotujesz, stanie się listą zmian, którą agent AI naniesie na źródłowy szkic."],
        [".pv-btn-comment", "Komentarz (c)", "Skomentuj bieżący slajd — albo najpierw zaznacz tekst, by skomentować fragment."],
        [".pv-btn-edit", "Edycja in-place (e)", "Popraw sformułowania wprost na slajdzie; drugie naciśnięcie zapisuje. W trybie edycji ✕ oznacza sekcję do usunięcia (klik ponownie = przywróć)."],
        [".pv-btn-suspend", "Zawieszenie (Shift+Z)", "Oznacz slajd do pominięcia przy następnej regeneracji — w źródle zostaje jako archiwum."],
        [".pv-btn-panel", "Twoja recenzja (r)", "Wszystkie uwagi wyeksportowane jako Markdown dla agenta. Z serwerem zapisują się same do pliku; jeśli recenzuje kilka osób, ustaw tu swoje imię."],
      ],
    },
  }[lang];

  /* ── engine ───────────────────────────────────── */
  const Z = 2147483000;
  let box, bubble, current = null, idx = 0;

  function ensureEls() {
    if (box) return;
    box = document.createElement("div");
    box.style.cssText = `position:fixed;z-index:${Z};border-radius:6px;pointer-events:none;` +
      `box-shadow:0 0 0 9999px rgba(0,0,0,.55);transition:all .25s ease;`;
    bubble = document.createElement("div");
    bubble.style.cssText = `position:fixed;z-index:${Z + 1};max-width:22rem;` +
      `background:#faf7f1;color:#2b2620;border-radius:8px;padding:1em 1.1em;` +
      `font:14px/1.5 "Alegreya Sans","Segoe UI",system-ui,sans-serif;` +
      `box-shadow:0 6px 30px rgba(0,0,0,.35);`;
    document.body.append(box, bubble);
    document.addEventListener("keydown", onKey, true);
  }

  function onKey(e) {
    if (!current) return;
    if (e.key === "Escape") { e.stopPropagation(); end(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.stopPropagation(); step(1); }
    else if (e.key === "ArrowLeft") { e.stopPropagation(); step(-1); }
  }

  function place(target) {
    if (target) {
      const r = target.getBoundingClientRect();
      box.style.display = "block";
      box.style.left = (r.left - 6) + "px";
      box.style.top = (r.top - 6) + "px";
      box.style.width = (r.width + 12) + "px";
      box.style.height = (r.height + 12) + "px";
      /* bubble below unless no room */
      const below = r.bottom + 14;
      bubble.style.left = Math.max(10, Math.min(r.left, innerWidth - 370)) + "px";
      if (below + 180 < innerHeight) { bubble.style.top = below + "px"; bubble.style.bottom = ""; }
      else { bubble.style.top = Math.max(10, r.top - 190) + "px"; bubble.style.bottom = ""; }
    } else {
      /* centered welcome step: dim everything */
      box.style.display = "block";
      box.style.left = "50%"; box.style.top = "20%";
      box.style.width = "0"; box.style.height = "0";
      bubble.style.left = "50%"; bubble.style.top = "50%";
      bubble.style.transform = "translate(-50%,-50%)";
    }
    if (target) bubble.style.transform = "";
  }

  function showStep() {
    const steps = S[current.name];
    const [sel, title, body] = steps[idx];
    const target = sel ? document.querySelector(sel) : null;
    if (sel && !target) { step(1); return; }   /* selector missing — skip */
    if (target) target.scrollIntoView({ block: "nearest" });
    place(target);
    const last = idx === steps.length - 1;
    bubble.innerHTML =
      `<div style="font-weight:700;margin-bottom:.3em">${title}</div>` +
      `<div>${body}</div>` +
      `<div style="display:flex;gap:.6em;align-items:center;margin-top:.9em">` +
      `<span style="opacity:.55;font-size:.85em">${idx + 1} ${S.of} ${steps.length}</span>` +
      `<span style="flex:1"></span>` +
      (idx > 0 ? `<button data-t="back" style="${btnCss(false)}">${S.back}</button>` : "") +
      `<button data-t="next" style="${btnCss(true)}">${last ? S.done : S.next}</button>` +
      (last ? "" : `<button data-t="skip" style="${btnCss(false)};opacity:.65">${S.skip}</button>`) +
      `</div>`;
    bubble.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.t;
      if (t === "next") step(1);
      else if (t === "back") step(-1);
      else end();
    }));
  }

  function btnCss(primary) {
    return `font:inherit;border-radius:4px;padding:.3em .9em;cursor:pointer;` +
      (primary ? `border:none;background:#7d5a3c;color:#faf7f1;font-weight:700`
               : `border:1px solid #d9d2c4;background:none;color:inherit`);
  }

  function step(d) {
    idx += d;
    const steps = S[current.name];
    if (idx < 0) idx = 0;
    if (idx >= steps.length) { end(); return; }
    showStep();
  }

  function end() {
    if (!current) return;
    try { localStorage.setItem("provludo-tour-seen:" + current.name, "1"); } catch {}
    box.style.display = "none";
    bubble.remove(); box.remove();
    box = bubble = null;
    document.removeEventListener("keydown", onKey, true);
    current = null;
  }

  function start(name) {
    if (!S[name]) return;
    if (current) end();
    current = { name };
    idx = 0;
    ensureEls();
    showStep();
  }

  function auto(name) {
    try {
      if (localStorage.getItem("provludo-tour-seen:" + name)) return;
    } catch { return; }
    /* wait a beat so the host UI finishes rendering */
    setTimeout(() => { if (!current) start(name); }, 600);
  }

  window.provludoTour = { start, auto };
  /* review overlay hides its ? button when the tour is absent at init;
   * unhide it now that we exist */
  document.querySelectorAll(".pv-btn-help").forEach(el => { el.style.display = ""; });
})();
