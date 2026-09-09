/* provludo review overlay — review layer for reveal.js presentations
 *
 * Inject with ONE tag, AFTER reveal.js initialization:
 *   <script src="review.js"></script>
 * (the provludo server injects it automatically at B slides/)
 *
 * Adds to a live presentation:
 *   💬  comment on a slide (or on a selected text fragment)
 *   ✏️  in-place content editing (contentEditable); in edit mode ✕ deletes a section
 *   ⏸  suspend a slide (archive) / 🗑 delete the whole slide / 📎 appendix
 *   📋  panel exporting everything as Markdown in the provludo convention
 *
 * Storage: localStorage; under the provludo server also a file next to the
 * deck (api/review → <deck>.review.json + .review.md). The export uses
 * <!-- suggestion --> / EDIT: / DELETE: / SUSPEND THIS SLIDE markers that
 * an AI agent reads and applies to the source draft (see AGENT.md).
 *
 * Deliberately a self-contained classic script (no ESM imports): it must
 * also work as a static <script> include with no server at all.
 */
(function () {
  'use strict';
  if (window.__provludoReview) return;
  window.__provludoReview = true;

  var VERSION = '0.1.0';
  var EDITABLE_SEL = 'h1,h2,h3,h4,h5,p,li,td,th,blockquote,figcaption,dt,dd,div';
  // divs with such children are containers/media, not text callouts — don't edit them
  var DIV_SKIP_SEL = 'canvas,svg,img,table,iframe,video';

  /* ───────────────────────────── i18n (inline by design) ───────────────── */
  var L = (function () {
    var lang = null;
    try { lang = localStorage.getItem('provludo-lang'); } catch (e) {}
    if (lang !== 'en' && lang !== 'pl')
      lang = (navigator.language || 'en').toLowerCase().indexOf('pl') === 0 ? 'pl' : 'en';
    var D = {
      en: {
        'btn.comment': 'Comment on slide / selection (select text first)  ·  key: c',
        'btn.edit': 'Edit slide content in place (✕ deletes a section)  ·  key: e',
        'btn.suspend': 'Suspend / unsuspend slide (archive)  ·  key: Shift+Z',
        'btn.slidedel': 'Delete whole slide (cut from source)  ·  key: Shift+X',
        'btn.appendix': 'Appendix — move slide to the end of the deck  ·  key: Shift+A',
        'btn.panel': 'Review panel & export  ·  key: r',
        'btn.help': 'Tour — what does what',
        'legend': '<b>c</b> comment &nbsp; <b>e</b> edit &nbsp; <b>⇧Z</b> suspend &nbsp; <b>⇧X</b> delete slide &nbsp; <b>⇧A</b> appendix &nbsp; <b>r</b> panel',
        'composer.fragment': 'Suggestion for a fragment',
        'composer.slide': 'Suggestion for slide ',
        'composer.placeholder': 'Write a suggestion for the AI agent…',
        'composer.cancel': 'Cancel',
        'composer.save': 'Save',
        'toast.suggestion': 'Saved suggestion for slide ',
        'toast.editMode': 'Edit mode — type in the text, ✕ deletes a section. ✏️ again = save.',
        'toast.sectionDel': 'Section marked for deletion',
        'toast.sectionBack': 'Section restored',
        'toast.copied': 'Copied to clipboard',
        'toast.cleared': 'Cleared',
        'toast.reset': 'Review applied by the agent — starting clean',
        'suspended.on': 'Suspended slide ', 'suspended.off': 'Unsuspended slide ',
        'slideDeletions.on': 'Slide marked for deletion — ', 'slideDeletions.off': 'Unmarked slide deletion ',
        'appendix.on': 'Slide → appendix — ', 'appendix.off': 'Removed from appendix ',
        'ribbon.suspended': 'SUSPENDED', 'ribbon.delete': 'TO DELETE', 'ribbon.appendix': '📎 APPENDIX',
        'panel.title': 'Review — export',
        'panel.hintServer': '✓ Auto-saved to a file next to the deck (.review.md). Anchor = slide number + locator.',
        'panel.hintLocal': 'Copy or download and hand it to your AI agent. Anchor = slide number + locator.',
        'panel.keys': 'Shortcuts: <b>c</b> comment · <b>e</b> edit (✕ deletes a section) · <b>⇧Z</b> suspend · <b>⇧X</b> delete slide · <b>⇧A</b> appendix · <b>r</b> panel',
        'panel.author': 'Reviewer name (optional):',
        'panel.copy': '📋 Copy', 'panel.download': '⬇︎ Download .md',
        'panel.clear': '🗑 Clear all', 'panel.close': 'Close',
        'confirm.clear': 'Delete all comments, edits and suspensions for this deck?',
        'del.title': 'Delete / restore this section',
        'noText': '(slide with no text)',
        'console.server': 'saving to a file next to the deck',
        'console.local': 'localStorage (run the provludo server to save to a file)'
      },
      pl: {
        'btn.comment': 'Komentarz do slajdu / zaznaczenia (zaznacz tekst przed kliknięciem)  ·  klawisz: c',
        'btn.edit': 'Edytuj treść slajdu in-place (✕ usuwa sekcję)  ·  klawisz: e',
        'btn.suspend': 'Zawieś / odwieś slajd (archiwum)  ·  klawisz: Shift+Z',
        'btn.slidedel': 'Usuń cały slajd (do wycięcia ze źródła)  ·  klawisz: Shift+X',
        'btn.appendix': 'Materiały dodatkowe — przenieś slajd na koniec  ·  klawisz: Shift+A',
        'btn.panel': 'Panel recenzji i eksport  ·  klawisz: r',
        'btn.help': 'Instruktaż — co co robi',
        'legend': '<b>c</b> komentarz &nbsp; <b>e</b> edycja &nbsp; <b>⇧Z</b> zawieś &nbsp; <b>⇧X</b> usuń slajd &nbsp; <b>⇧A</b> dodatkowe &nbsp; <b>r</b> panel',
        'composer.fragment': 'Sugestia do fragmentu',
        'composer.slide': 'Sugestia do slajdu ',
        'composer.placeholder': 'Napisz sugestię dla agenta AI…',
        'composer.cancel': 'Anuluj',
        'composer.save': 'Zapisz',
        'toast.suggestion': 'Zapisano sugestię do slajdu ',
        'toast.editMode': 'Tryb edycji — pisz w tekście, ✕ usuwa sekcję. ✏️ ponownie = zapisz.',
        'toast.sectionDel': 'Sekcja oznaczona do usunięcia',
        'toast.sectionBack': 'Przywrócono sekcję',
        'toast.copied': 'Skopiowano do schowka',
        'toast.cleared': 'Wyczyszczono',
        'toast.reset': 'Recenzja naniesiona przez agenta — zaczynamy od zera',
        'suspended.on': 'Zawieszono slajd ', 'suspended.off': 'Odwieszono slajd ',
        'slideDeletions.on': 'Slajd do usunięcia — ', 'slideDeletions.off': 'Cofnięto usunięcie slajdu ',
        'appendix.on': 'Slajd → materiały dodatkowe — ', 'appendix.off': 'Zdjęto z materiałów dodatkowych ',
        'ribbon.suspended': 'ZAWIESZONY', 'ribbon.delete': 'DO USUNIĘCIA', 'ribbon.appendix': '📎 MATERIAŁY DODATKOWE',
        'panel.title': 'Recenzja — eksport',
        'panel.hintServer': '✓ Zapisywane automatycznie do pliku obok decka (.review.md). Kotwica = numer slajdu + locator.',
        'panel.hintLocal': 'Skopiuj lub pobierz i przekaż agentowi AI. Kotwica = numer slajdu + locator.',
        'panel.keys': 'Skróty: <b>c</b> komentarz · <b>e</b> edycja (✕ usuwa sekcję) · <b>⇧Z</b> zawieś · <b>⇧X</b> usuń slajd · <b>⇧A</b> dodatkowe · <b>r</b> panel',
        'panel.author': 'Imię recenzenta (opcjonalne):',
        'panel.copy': '📋 Kopiuj', 'panel.download': '⬇︎ Pobierz .md',
        'panel.clear': '🗑 Wyczyść wszystko', 'panel.close': 'Zamknij',
        'confirm.clear': 'Skasować wszystkie komentarze, edycje i zawieszenia dla tej prezentacji?',
        'del.title': 'Usuń / przywróć tę sekcję',
        'noText': '(slajd bez tekstu)',
        'console.server': 'zapis do pliku obok decka',
        'console.local': 'localStorage (uruchom serwer provludo, by zapisywać do pliku)'
      }
    };
    var d = D[lang];
    return function (k) { return d[k] !== undefined ? d[k] : D.en[k] || k; };
  })();

  /* ───────────────────────────── bootstrap ─────────────────────────────── */
  function whenReady(cb) {
    if (window.Reveal && Reveal.isReady && Reveal.isReady()) return cb();
    if (window.Reveal && Reveal.on) return void Reveal.on('ready', cb);
    var tries = 0;
    var t = setInterval(function () {
      if (window.Reveal) {
        clearInterval(t);
        if (Reveal.isReady && Reveal.isReady()) cb();
        else Reveal.on('ready', cb);
      } else if (++tries > 100) {
        clearInterval(t);
        console.warn('[provludo-review] Reveal not found — skipping.');
      }
    }, 100);
  }

  /* ───────────────────────────── state ─────────────────────────────────── */
  var KEY = 'provludo-review:' + location.pathname;
  var RKEY = KEY + ':reset';
  var state = load() || { comments: [], edits: [], suspended: [], deletions: [] };
  normalize(state);
  var editMode = false;
  var keyboardWasOn = true;
  var SERVER = { on: false }; // true when served by the provludo server

  function normalize(s) {
    s.comments = s.comments || [];
    s.edits = s.edits || [];
    s.suspended = s.suspended || [];
    s.deletions = s.deletions || [];
    s.slideDeletions = s.slideDeletions || [];
    s.appendix = s.appendix || [];
    return s;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch (e) { return null; }
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('[provludo-review] localStorage unavailable', e); }
    refreshBadge();
  }
  function save() {
    saveLocal();
    syncServer();
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function author() {
    try { return (localStorage.getItem('provludo-author') || '').trim(); }
    catch (e) { return ''; }
  }
  function withAuthor(entry) {
    var a = author();
    if (a) entry.author = a;
    return entry;
  }

  /* ─────────────── file persistence via the provludo server ────────────── */
  // When the deck is served by the provludo server, `api/review` (relative
  // to the deck's base URL) exists: state goes to a file next to the deck
  // and the server is the source of truth on reopen. Without a server —
  // silent fallback to localStorage (classic static mode).
  function detectServer(cb) {
    fetch('api/review', { method: 'GET', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (remote) {
        SERVER.on = true;
        // agent-driven reset: the server carries a `_resetAt` epoch (bumped after
        // an agent applies the review). If it is newer than the one we last saw,
        // wipe the local state so this reload starts clean instead of re-seeding
        // the server.
        var seen = +localStorage.getItem(RKEY) || 0;
        if (remote && remote._resetAt && remote._resetAt > seen) {
          localStorage.setItem(RKEY, String(remote._resetAt));
          state = normalize({});           // empty
          save();                          // persist empty locally + push empty to server
          cb && cb();
          return;
        }
        var nonEmpty = function (o) {
          o = o || {};
          return ['comments', 'edits', 'deletions', 'suspended', 'slideDeletions', 'appendix']
            .some(function (k) { return o[k] && o[k].length; });
        };
        if (nonEmpty(remote)) {
          state = normalize(remote);       // server wins
          saveLocal();
        } else if (nonEmpty(state)) {
          syncServer();                    // seed the server from localStorage
        }
        cb && cb();
      })
      .catch(function () { SERVER.on = false; cb && cb(); });
  }
  var syncT;
  function syncServer() {
    if (!SERVER.on) return;
    clearTimeout(syncT);
    syncT = setTimeout(function () {
      syncT = null;
      fetch('api/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: state, markdown: buildExport() })
      }).catch(function () { /* offline — localStorage still has it */ });
    }, 500);
  }

  /* ─────────────── live updates via SSE (server mode only) ─────────────── */
  function startSSE() {
    if (!SERVER.on || typeof EventSource === 'undefined') return;
    var es;
    try { es = new EventSource('api/events'); } catch (e) { return; }
    es.addEventListener('review-changed', function () {
      if (syncT) return;                   // our own write is in flight
      refetchState();
    });
    es.addEventListener('deck-changed', function () {
      // deck HTML regenerated on disk — reload unless the user is mid-action
      if (editMode || syncT || document.querySelector('.pv-modal-back')) return;
      location.reload();
    });
  }
  function refetchState() {
    fetch('api/review', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        if (!remote) return;
        var seen = +localStorage.getItem(RKEY) || 0;
        if (remote._resetAt && remote._resetAt > seen) {
          localStorage.setItem(RKEY, String(remote._resetAt));
          clearAllDom();
          state = normalize({});
          saveLocal();
          toast(L('toast.reset'));
          return;
        }
        state = normalize(remote);
        saveLocal();
        reapplySuspended();
        reapplyEdits();
        reapplyDeletions();
      })
      .catch(function () {});
  }

  /* ───────────────────────────── slides ────────────────────────────────── */
  function currentSection() {
    return Reveal.getCurrentSlide();
  }
  function slideNumber(section) {
    return Reveal.getSlides().indexOf(section) + 1; // flat 1-based number
  }
  function locatorFor(section) {
    var h = section.querySelector('h1,h2,h3,h4');
    if (h && h.textContent.trim()) return h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70);
    var t = (section.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 70) || L('noText');
  }
  function slideKey(section) {
    // stable-ish key for reattaching state after reload (number + locator)
    return slideNumber(section) + '¦' + locatorFor(section);
  }

  /* ─────────────────── reveal keyboard suspension ──────────────────────── */
  function suspendKeyboard() {
    if (Reveal.getConfig && Reveal.getConfig().keyboard === false) return;
    keyboardWasOn = true;
    Reveal.configure({ keyboard: false });
  }
  function resumeKeyboard() {
    if (keyboardWasOn) Reveal.configure({ keyboard: true });
  }

  /* ───────────────────────────── comments ──────────────────────────────── */
  function addComment() {
    var section = currentSection();
    var sel = (window.getSelection && window.getSelection().toString().trim()) || '';
    openComposer({
      title: sel ? L('composer.fragment') : L('composer.slide') + slideNumber(section),
      hint: sel ? '"' + sel.slice(0, 80) + (sel.length > 80 ? '…' : '') + '"' : locatorFor(section),
      onSave: function (text) {
        if (!text.trim()) return;
        state.comments.push(withAuthor({
          id: uid(),
          key: slideKey(section),
          slide: slideNumber(section),
          locator: locatorFor(section),
          fragment: sel,
          text: text.trim(),
          ts: Date.now()
        }));
        save();
        toast(L('toast.suggestion') + slideNumber(section));
      }
    });
  }

  /* ───────────────────────────── in-place editing ──────────────────────── */
  function toggleEdit() {
    var section = currentSection();
    if (editMode) { exitEdit(section); }
    else { enterEdit(section); }
  }
  function leafEditables(section) {
    return Array.prototype.filter.call(
      section.querySelectorAll(EDITABLE_SEL),
      function (el) {
        if (el.querySelector(EDITABLE_SEL)) return false;      // has nested editable
        if (el.tagName === 'DIV') {                             // div = only text callout/card
          if (el.querySelector(DIV_SKIP_SEL)) return false;    // chart/table/image container
          if (!el.textContent.trim()) return false;            // empty layout
        }
        return true;
      }
    );
  }
  function enterEdit(section) {
    editMode = true;
    suspendKeyboard();
    section.classList.add('pv-editing');
    leafEditables(section).forEach(function (el) {
      el.dataset.pvOrig = el.textContent.trim().replace(/\s+/g, ' ');
      el.setAttribute('contenteditable', 'true');
      el.classList.add('pv-editable');
      if (!el.__pvDelBound) {
        el.addEventListener('mouseenter', onEditableEnter);
        el.addEventListener('mouseleave', scheduleHideDel);
        el.__pvDelBound = true;
      }
    });
    document.body.classList.add('pv-edit-on');
    toast(L('toast.editMode'));
  }
  function exitEdit(section) {
    editMode = false;
    section.classList.remove('pv-editing');
    Array.prototype.forEach.call(section.querySelectorAll('.pv-editable'), function (el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('pv-editable');
      var before = el.dataset.pvOrig || '';
      var after = el.textContent.trim().replace(/\s+/g, ' ');
      if (after !== before) recordEdit(section, before, after);
      delete el.dataset.pvOrig;
    });
    document.body.classList.remove('pv-edit-on');
    if (delBtn) delBtn.style.display = 'none';
    resumeKeyboard();
    save();
  }
  function recordEdit(section, before, after) {
    state.edits.push(withAuthor({
      id: uid(),
      key: slideKey(section),
      slide: slideNumber(section),
      locator: locatorFor(section),
      before: before,
      after: after,
      ts: Date.now()
    }));
  }
  // After a reload, reapply saved edits onto the DOM (the static file reverts).
  function reapplyEdits() {
    var sections = Reveal.getSlides();
    state.edits.forEach(function (e) {
      var section = sections[e.slide - 1];
      if (!section) return;
      var hit = leafEditables(section).filter(function (el) {
        return el.textContent.trim().replace(/\s+/g, ' ') === e.before;
      })[0];
      if (hit) { hit.textContent = e.after; hit.classList.add('pv-edited'); }
    });
  }

  /* ───────────────────────────── section deletion ──────────────────────── */
  // Deletion target: for a table cell the whole row, otherwise the element.
  function deletionTarget(el) {
    if (el.tagName === 'TD' || el.tagName === 'TH') return el.closest('tr') || el;
    return el;
  }
  var delBtn, delHideT;
  function ensureDelBtn() {
    if (delBtn) return delBtn;
    delBtn = el('button', 'pv-del');
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.title = L('del.title');
    delBtn.style.display = 'none';
    delBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    delBtn.addEventListener('mouseenter', function () { clearTimeout(delHideT); });
    delBtn.addEventListener('mouseleave', scheduleHideDel);
    delBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (delBtn._target) toggleDelete(delBtn._target);
    });
    document.body.appendChild(delBtn);
    return delBtn;
  }
  function onEditableEnter(e) {
    if (!editMode) return;
    var tgt = deletionTarget(e.currentTarget);
    var b = ensureDelBtn();
    clearTimeout(delHideT);
    b._target = tgt;
    var r = tgt.getBoundingClientRect();
    b.style.display = 'flex';
    b.style.top = Math.max(2, r.top + 1) + 'px';
    b.style.left = Math.max(2, r.left - 22) + 'px';
  }
  function scheduleHideDel() {
    delHideT = setTimeout(function () { if (delBtn) delBtn.style.display = 'none'; }, 220);
  }
  function toggleDelete(tgt) {
    var section = tgt.closest('section');
    var text = (tgt.dataset.pvOrig || tgt.textContent).trim().replace(/\s+/g, ' ');
    if (tgt.classList.contains('pv-deleted')) {
      tgt.classList.remove('pv-deleted');
      unrecordDeletion(section, text);
      toast(L('toast.sectionBack'));
    } else {
      tgt.classList.add('pv-deleted');
      recordDeletion(section, text);
      toast(L('toast.sectionDel'));
    }
    save();
  }
  function recordDeletion(section, text) {
    state.deletions.push(withAuthor({
      id: uid(),
      key: slideKey(section),
      slide: slideNumber(section),
      locator: locatorFor(section),
      text: text,
      ts: Date.now()
    }));
  }
  function unrecordDeletion(section, text) {
    var n = slideNumber(section);
    state.deletions = state.deletions.filter(function (d) {
      return !(d.slide === n && d.text === text);
    });
  }
  function reapplyDeletions() {
    var sections = Reveal.getSlides();
    state.deletions.forEach(function (d) {
      var section = sections[d.slide - 1];
      if (!section) return;
      var all = Array.prototype.slice.call(section.querySelectorAll(EDITABLE_SEL + ',tr'));
      var hit = all.filter(function (el) {
        return el.textContent.trim().replace(/\s+/g, ' ') === d.text;
      })[0];
      if (hit) hit.classList.add('pv-deleted');
    });
  }

  /* ──────────────── slide-level marks (mutually exclusive) ─────────────── */
  //   suspended      → ⏸  archive (<!-- suspended -->), skipped at generation
  //   slideDeletions → 🗑  cut from the source (DELETE THIS SLIDE)
  //   appendix       → 📎  extra material — moved to the end of the deck
  var SLIDE_KINDS = ['suspended', 'slideDeletions', 'appendix'];
  var KIND_META = {
    suspended:      { cls: 'pv-suspended', ribbon: 'pv-ribbon-susp', label: L('ribbon.suspended'),
                      on: L('suspended.on'), off: L('suspended.off') },
    slideDeletions: { cls: 'pv-slide-del', ribbon: 'pv-ribbon-del', label: L('ribbon.delete'),
                      on: L('slideDeletions.on'), off: L('slideDeletions.off') },
    appendix:       { cls: 'pv-slide-app', ribbon: 'pv-ribbon-app', label: L('ribbon.appendix'),
                      on: L('appendix.on'), off: L('appendix.off') }
  };
  function slideMark(kind) {
    var section = currentSection();
    var n = slideNumber(section);
    var arr = state[kind];
    var i = arr.findIndex(function (s) { return s.slide === n; });
    if (i >= 0) {
      arr.splice(i, 1);
      toast(KIND_META[kind].off + n);
    } else {
      SLIDE_KINDS.forEach(function (k) {  // mutually exclusive — clear the others
        if (k !== kind) state[k] = state[k].filter(function (s) { return s.slide !== n; });
      });
      arr.push(withAuthor({ key: slideKey(section), slide: n, locator: locatorFor(section), ts: Date.now() }));
      toast(KIND_META[kind].on + n);
    }
    applySlideMarks(section);
    save();
  }
  function toggleSuspend() { slideMark('suspended'); }
  function toggleSlideDelete() { slideMark('slideDeletions'); }
  function toggleAppendix() { slideMark('appendix'); }

  function hasSlide(kind, n) { return state[kind].some(function (s) { return s.slide === n; }); }
  function applySlideMarks(section) {
    var n = slideNumber(section);
    section.classList.remove('pv-suspended', 'pv-slide-del', 'pv-slide-app');
    var old = section.querySelector('.pv-ribbon'); if (old) old.remove();
    var kind = SLIDE_KINDS.filter(function (k) { return hasSlide(k, n); })[0];
    if (!kind) return;
    var meta = KIND_META[kind];
    section.classList.add(meta.cls);
    var r = document.createElement('div');
    r.className = 'pv-ribbon ' + meta.ribbon;
    r.textContent = meta.label;
    section.appendChild(r);
  }
  function unmarkSlide(section) { // used by "clear all" and agent reset
    section.classList.remove('pv-suspended', 'pv-slide-del', 'pv-slide-app');
    var r = section.querySelector('.pv-ribbon'); if (r) r.remove();
  }
  function reapplySuspended() {
    var sections = Reveal.getSlides();
    var seen = {};
    state.suspended.concat(state.slideDeletions, state.appendix).forEach(function (s) {
      if (seen[s.slide]) return; seen[s.slide] = 1;
      var section = sections[s.slide - 1];
      if (section) applySlideMarks(section);
    });
  }
  function clearAllDom() {
    Reveal.getSlides().forEach(unmarkSlide);
    Array.prototype.forEach.call(document.querySelectorAll('.pv-edited'), function (e) { e.classList.remove('pv-edited'); });
    Array.prototype.forEach.call(document.querySelectorAll('.pv-deleted'), function (e) { e.classList.remove('pv-deleted'); });
  }

  /* ───────────────────────────── export ────────────────────────────────── */
  // The exported Markdown is part of the provludo FORMAT — always English,
  // regardless of the UI language (see AGENT.md).
  function aut(x) { return x && x.author ? ' — ' + x.author : ''; }
  function buildExport() {
    var title = document.title || 'deck';
    var d = new Date();
    var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var lines = ['# Review: ' + title + ' — ' + stamp, ''];

    // group everything by slide number
    var bySlide = {};
    function bucket(n, loc) {
      if (!bySlide[n]) bySlide[n] = { locator: loc, comments: [], edits: [], deletions: [],
                                      suspended: null, slideDel: null, appendix: null };
      return bySlide[n];
    }
    state.comments.forEach(function (c) { bucket(c.slide, c.locator).comments.push(c); });
    state.edits.forEach(function (e) { bucket(e.slide, e.locator).edits.push(e); });
    state.deletions.forEach(function (d) { bucket(d.slide, d.locator).deletions.push(d); });
    state.suspended.forEach(function (s) { bucket(s.slide, s.locator).suspended = s; });
    state.slideDeletions.forEach(function (s) { bucket(s.slide, s.locator).slideDel = s; });
    state.appendix.forEach(function (s) { bucket(s.slide, s.locator).appendix = s; });

    var nums = Object.keys(bySlide).map(Number).sort(function (a, b) { return a - b; });
    if (!nums.length) return '# Review: ' + title + '\n\n(no remarks)\n';

    nums.forEach(function (n) {
      var b = bySlide[n];
      lines.push('## Slide ' + n + ' — "' + b.locator + '"');
      if (b.slideDel) lines.push('DELETE THIS SLIDE' + aut(b.slideDel));
      if (b.appendix) lines.push('TO APPENDIX (move to the end)' + aut(b.appendix));
      if (b.suspended) lines.push('SUSPEND THIS SLIDE' + aut(b.suspended));
      b.comments.forEach(function (c) {
        if (c.fragment) lines.push('<!-- suggestion @ "' + c.fragment.replace(/\s+/g, ' ').trim() + '": ' + c.text + aut(c) + ' -->');
        else lines.push('<!-- suggestion: ' + c.text + aut(c) + ' -->');
      });
      b.edits.forEach(function (e) {
        lines.push('EDIT: «' + e.before + '» → «' + e.after + '»' + aut(e));
      });
      b.deletions.forEach(function (d) {
        lines.push('DELETE: «' + d.text + '»' + aut(d));
      });
      lines.push('');
    });
    return lines.join('\n');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ───────────────────────────── UI: toolbar ───────────────────────────── */
  var badgeEl, helpBtn;
  function refreshBadge() {
    if (!badgeEl) return;
    var n = state.comments.length + state.edits.length + state.deletions.length +
      state.suspended.length + state.slideDeletions.length + state.appendix.length;
    badgeEl.textContent = n;
    badgeEl.style.display = n ? 'flex' : 'none';
  }
  function buildToolbar() {
    var bar = el('div', 'pv-toolbar');
    bar.appendChild(btn('💬', L('btn.comment'), addComment, 'pv-btn-comment'));
    bar.appendChild(btn('✏️', L('btn.edit'), toggleEdit, 'pv-btn-edit'));
    bar.appendChild(btn('⏸', L('btn.suspend'), toggleSuspend, 'pv-btn-suspend'));
    bar.appendChild(btn('🗑', L('btn.slidedel'), toggleSlideDelete, 'pv-btn-slidedel'));
    bar.appendChild(btn('📎', L('btn.appendix'), toggleAppendix, 'pv-btn-appendix'));
    var pbtn = btn('📋', L('btn.panel'), openPanel, 'pv-btn-panel');
    badgeEl = el('span', 'pv-badge'); badgeEl.style.display = 'none';
    pbtn.appendChild(badgeEl);
    bar.appendChild(pbtn);
    helpBtn = btn('?', L('btn.help'), function () {
      if (window.provludoTour) window.provludoTour.start('review');
    }, 'pv-btn-help');
    helpBtn.style.display = 'none';   // shown in init when a tour is available
    bar.appendChild(helpBtn);
    var legend = el('div', 'pv-legend');
    legend.innerHTML = L('legend');
    bar.appendChild(legend);
    document.body.appendChild(bar);
    refreshBadge();
  }

  /* ───────────────────────────── UI: composer ──────────────────────────── */
  function openComposer(opts) {
    suspendKeyboard();
    var back = el('div', 'pv-modal-back');
    var box = el('div', 'pv-modal');
    box.innerHTML = '<h3></h3><div class="pv-hint"></div>' +
      '<textarea class="pv-ta" rows="4"></textarea>' +
      '<div class="pv-row">' +
        '<button class="pv-cancel"></button>' +
        '<button class="pv-ok"></button>' +
      '</div>';
    box.querySelector('h3').textContent = opts.title;
    box.querySelector('.pv-hint').textContent = opts.hint || '';
    box.querySelector('.pv-ta').placeholder = L('composer.placeholder');
    box.querySelector('.pv-cancel').innerHTML = L('composer.cancel') + ' <kbd class="pv-kbd">Esc</kbd>';
    box.querySelector('.pv-ok').innerHTML = L('composer.save') + ' <kbd class="pv-kbd">⌘/Ctrl+↵</kbd>';
    back.appendChild(box); document.body.appendChild(back);
    var ta = box.querySelector('.pv-ta');
    ta.focus();
    stopKeys(box);
    function close() { document.removeEventListener('keydown', onKey, true); back.remove(); resumeKeyboard(); }
    // On document (capture), not on box: Esc/⌘+↵ must work regardless of where
    // the focus is (e.g. back on the slide), not only inside the modal.
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); opts.onSave(ta.value); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    box.querySelector('.pv-cancel').onclick = close;
    box.querySelector('.pv-ok').onclick = function () { opts.onSave(ta.value); close(); };
    back.onclick = function (e) { if (e.target === back) close(); };
  }

  /* ───────────────────────────── UI: panel ─────────────────────────────── */
  function openPanel() {
    suspendKeyboard();
    var back = el('div', 'pv-modal-back');
    var box = el('div', 'pv-modal pv-panel');
    var md = buildExport();
    box.innerHTML =
      '<h3></h3>' +
      '<div class="pv-hint"></div>' +
      '<div class="pv-keys"></div>' +
      '<label class="pv-author-row"><span></span> <input class="pv-author" type="text" maxlength="60"></label>' +
      '<textarea class="pv-ta pv-export" rows="14" readonly></textarea>' +
      '<div class="pv-row pv-row-wrap">' +
        '<button class="pv-copy"></button>' +
        '<button class="pv-dl"></button>' +
        '<button class="pv-clear pv-danger"></button>' +
        '<button class="pv-cancel"></button>' +
      '</div>';
    box.querySelector('h3').textContent = L('panel.title');
    box.querySelector('.pv-keys').innerHTML = L('panel.keys');
    box.querySelector('.pv-author-row span').textContent = L('panel.author');
    box.querySelector('.pv-copy').textContent = L('panel.copy');
    box.querySelector('.pv-dl').textContent = L('panel.download');
    box.querySelector('.pv-clear').textContent = L('panel.clear');
    box.querySelector('.pv-cancel').innerHTML = L('panel.close') + ' <kbd class="pv-kbd">Esc</kbd>';
    box.querySelector('.pv-export').value = md;
    box.querySelector('.pv-hint').textContent = SERVER.on ? L('panel.hintServer') : L('panel.hintLocal');
    var authorInput = box.querySelector('.pv-author');
    authorInput.value = author();
    authorInput.addEventListener('input', function () {
      try { localStorage.setItem('provludo-author', authorInput.value.trim()); } catch (e) {}
    });
    back.appendChild(box); document.body.appendChild(back);
    stopKeys(box);
    function close() { document.removeEventListener('keydown', onKey, true); back.remove(); resumeKeyboard(); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    box.querySelector('.pv-cancel').onclick = close;
    back.onclick = function (e) { if (e.target === back) close(); };
    box.querySelector('.pv-copy').onclick = function () {
      copy(md); toast(L('toast.copied'));
    };
    box.querySelector('.pv-dl').onclick = function () { download(md); };
    box.querySelector('.pv-clear').onclick = function () {
      if (!confirm(L('confirm.clear'))) return;
      state = normalize({});
      save();
      clearAllDom();
      close();
      toast(L('toast.cleared'));
    };
  }

  /* ───────────────────────────── helpers ───────────────────────────────── */
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function btn(label, title, fn, cls) {
    var b = el('button', 'pv-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button'; b.title = title; b.textContent = label;
    b.onclick = fn; return b;
  }
  function stopKeys(node) {
    node.addEventListener('keydown', function (e) { e.stopPropagation(); }, true);
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = el('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }
  function download(text) {
    var blob = new Blob([text], { type: 'text/markdown' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'review-' + (location.pathname.replace(/[\/]/g, '_') || 'deck') + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', 'pv-toast'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('pv-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('pv-show'); }, 2200);
  }

  /* ───────────────────────────── keyboard shortcuts ────────────────────── */
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'c') { e.preventDefault(); addComment(); }
      else if (e.key === 'e') { e.preventDefault(); toggleEdit(); }
      // Shift+Z/X/A to stay clear of reveal's own bindings
      else if (e.key === 'Z') { e.preventDefault(); toggleSuspend(); }
      else if (e.key === 'X') { e.preventDefault(); toggleSlideDelete(); }
      else if (e.key === 'A') { e.preventDefault(); toggleAppendix(); }
      else if (e.key === 'r') { e.preventDefault(); openPanel(); }
    });
  }

  /* ───────────────────────────── styles ────────────────────────────────── */
  function injectCSS() {
    var css = `
.pv-toolbar{position:fixed;top:12px;right:12px;left:auto;bottom:auto;z-index:10050;
  display:flex;gap:3px;opacity:.28;transition:opacity .2s;
  font-family:system-ui,-apple-system,sans-serif;}
.pv-toolbar:hover{opacity:1;}
.pv-btn{position:relative;width:26px;height:26px;border:none;border-radius:6px;
  background:transparent;color:#999;font-size:13px;line-height:1;cursor:pointer;
  filter:grayscale(1);transition:background .15s,color .15s,transform .1s;}
.pv-btn:hover{background:rgba(18,22,20,.92);color:#fff;transform:translateY(1px);}
body.pv-edit-on .pv-btn-edit{background:rgba(18,22,20,.96);color:#fff;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.45);}
.pv-btn-help{font-weight:700;filter:none;}
.pv-badge{position:absolute;top:-4px;right:-4px;min-width:14px;height:14px;padding:0 3px;
  background:#666;color:#fff;border-radius:7px;font-size:9px;font-weight:700;
  display:flex;align-items:center;justify-content:center;}
.pv-legend{position:absolute;top:32px;right:0;white-space:nowrap;
  background:rgba(18,22,20,.94);color:#dfe;font-size:11px;line-height:1;
  padding:6px 9px;border-radius:6px;opacity:0;transition:opacity .15s;pointer-events:none;
  box-shadow:0 2px 8px rgba(0,0,0,.3);}
.pv-toolbar:hover .pv-legend{opacity:1;}
.pv-legend b{color:#fff;font-family:ui-monospace,monospace;font-weight:700;}
.pv-keys{font-size:12px;color:#555;margin:-4px 0 12px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.pv-keys b{color:#222;}
.pv-modal-back{position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.45);
  display:flex;align-items:center;justify-content:center;
  font-family:system-ui,-apple-system,sans-serif;}
.pv-modal{background:#fff;color:#1a1a1a;width:min(560px,92vw);max-height:88vh;overflow:auto;
  border-radius:14px;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
.pv-modal h3{margin:0 0 4px;font-size:18px;}
.pv-hint{color:#666;font-size:13px;margin-bottom:12px;font-style:italic;word-break:break-word;}
.pv-author-row{display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:13px;color:#444;}
.pv-author-row input{flex:1;border:1px solid #ccc;border-radius:6px;padding:5px 8px;
  font:13px system-ui,sans-serif;}
.pv-ta{width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:8px;padding:10px;
  font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;}
.pv-export{background:#f7f7f5;}
.pv-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;}
.pv-row-wrap{flex-wrap:wrap;}
.pv-row button{border:none;border-radius:8px;padding:8px 14px;font-size:14px;cursor:pointer;
  background:#e8e8e6;color:#222;}
.pv-row .pv-ok,.pv-row .pv-copy{background:#2e8c7e;color:#fff;}
.pv-row .pv-danger{background:#f2dede;color:#a0301a;margin-right:auto;}
.pv-row button:hover{filter:brightness(.96);}
.pv-kbd{display:inline-block;margin-left:.4em;padding:1px 5px;border-radius:4px;
  font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  background:rgba(0,0,0,.16);color:inherit;opacity:.85;vertical-align:baseline;}
.pv-editable{outline:1px dashed rgba(230,126,34,.7);outline-offset:3px;border-radius:2px;
  cursor:text;min-height:1em;}
.pv-editable:focus{outline:2px solid #e67e22;background:rgba(230,126,34,.06);}
.pv-edited{background:rgba(46,140,126,.10);box-shadow:inset 0 -2px 0 rgba(46,140,126,.5);}
.pv-del{position:fixed;z-index:10055;width:19px;height:19px;padding:0;border:none;
  border-radius:50%;background:#a0301a;color:#fff;font-size:11px;line-height:1;cursor:pointer;
  align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35);}
.pv-del:hover{background:#c0392b;transform:scale(1.1);}
.pv-deleted{opacity:.4;text-decoration:line-through;text-decoration-color:#a0301a;
  text-decoration-thickness:2px;}
/* dim without touching section opacity (reveal animates opacity — ghosting) */
.reveal .slides section.pv-suspended,
.reveal .slides section.pv-slide-del{ filter:grayscale(.55); }
.reveal .slides section.pv-suspended::before,
.reveal .slides section.pv-slide-del::before,
.reveal .slides section.pv-slide-app::before{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:4;}
.reveal .slides section.pv-suspended::before{ background:rgba(90,90,90,.34); }
.reveal .slides section.pv-slide-del::before{ background:rgba(160,48,26,.24); }
.reveal .slides section.pv-slide-app::before{ background:rgba(125,90,60,.20); }
.pv-ribbon{position:absolute;top:6px;left:50%;transform:translateX(-50%);
  color:#fff;font:700 11px/1 system-ui,sans-serif;letter-spacing:.1em;
  padding:5px 12px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.3);
  pointer-events:none;z-index:5;white-space:nowrap;}
.pv-ribbon-susp{background:#8a6d1f;}
.pv-ribbon-del{background:#a0301a;}
.pv-ribbon-app{background:#7d5a3c;}
.pv-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%) translateY(12px);
  z-index:10070;background:rgba(20,28,26,.95);color:#fff;padding:10px 16px;border-radius:10px;
  font:14px system-ui,sans-serif;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;
  max-width:80vw;text-align:center;}
.pv-toast.pv-show{opacity:1;transform:translateX(-50%) translateY(0);}
`;
    var s = el('style'); s.id = 'pv-style'; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ───────────────────────────── init ──────────────────────────────────── */
  whenReady(function () {
    injectCSS();
    buildToolbar();
    bindKeys();
    detectServer(function () {
      refreshBadge();
      reapplySuspended();
      reapplyEdits();
      reapplyDeletions();
      startSSE();
      if (window.provludoTour) {
        helpBtn.style.display = '';
        if (window.provludoTour.auto) window.provludoTour.auto('review');
      }
      var where = SERVER.on ? L('console.server') : L('console.local');
      console.log('[provludo-review] v' + VERSION + ' — ' + where +
        ' · c / e / Shift+Z / Shift+X / Shift+A / r');
    });
  });
})();
