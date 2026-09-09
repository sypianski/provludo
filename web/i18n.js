/* provludo — tiny i18n. UI strings only; the file format is always English.
 * Served at /__provludo/i18n.js. The editor/wrapper/tour import this as ESM.
 * (The review overlay is self-contained by design — it must also work as a
 * static <script> without the server — so it carries its own inline dict.)
 */

const DICT = {
  en: {
    /* wrapper */
    "wrapper.slides": "▭ slides",
    "wrapper.text": "¶ text",
    "wrapper.noDeck": "No deck yet — this project has no generated presentation. Ask your AI agent to generate one from the draft.",
    /* generic */
    "lang.name": "English",
  },
  pl: {
    "wrapper.slides": "▭ slajdy",
    "wrapper.text": "¶ tekst",
    "wrapper.noDeck": "Nie ma jeszcze decka — projekt nie ma wygenerowanej prezentacji. Poproś agenta AI o wygenerowanie jej ze szkicu.",
    "lang.name": "polski",
  },
};

function resolveLang() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q && DICT[q]) { localStorage.setItem("provludo-lang", q); return q; }
    const s = localStorage.getItem("provludo-lang");
    if (s && DICT[s]) return s;
  } catch { /* no localStorage (e.g. file:) */ }
  return (navigator.language || "en").toLowerCase().startsWith("pl") ? "pl" : "en";
}

let lang = resolveLang();

export function t(key) {
  return DICT[lang]?.[key] ?? DICT.en[key] ?? key;
}
export function getLang() { return lang; }
export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try { localStorage.setItem("provludo-lang", l); } catch {}
}
export function extendDict(extra) {
  for (const [l, entries] of Object.entries(extra)) {
    DICT[l] = Object.assign(DICT[l] || {}, entries);
  }
}
export { DICT };
