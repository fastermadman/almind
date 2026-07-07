// Import: .docx (mammoth) og .md → blokke. Reglen er deterministisk og
// gennemskuelig: overskrifter bliver til faser, punktlister til aktiviteter,
// afsnit til fasetekst. Ingen semantisk gætteri — callouts og åbne pladser
// er det didaktiske lag, og det forfatter læreren selv i editoren bagefter.
// Ingen overskrifter i dokumentet → alt lander i én fase til manuel opdeling.

// Danske Word-dokumenter navngiver typografierne "Overskrift N" — mammoths
// indbyggede mapping kender kun de engelske navne.
const STYLE_MAP = [
  "p[style-name='Overskrift 1'] => h1:fresh",
  "p[style-name='Overskrift 2'] => h2:fresh",
  "p[style-name='Overskrift 3'] => h3:fresh",
  "p[style-name='Overskrift 4'] => h4:fresh",
];

export async function parseDocx(arrayBuffer) {
  const res = await window.mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP });
  return htmlTilBlokke(res.value);
}

export function parseMarkdown(md) {
  return htmlTilBlokke(mdTilHtml(md));
}

// ---------- fælles: semantisk HTML → fase-blokke ----------

function tekst(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

function htmlTilBlokke(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const born = [...doc.body.children];

  let titel = "";
  if (born[0]?.tagName === "H1") titel = tekst(born.shift());

  // Faseskel, to deterministiske regler (kalibreret mod MinerU-output af T1-T5):
  // 1. Findes der mindst to overskrifter der starter med "Fase ...", er KUN de
  //    faseskel — alle andre overskrifter folder ind som fasetekst. Det redder
  //    dokumenter med støjende overskriftsniveauer (PDF-udtræk, MinerU).
  // 2. Ellers: det øverste overskriftsniveau der optræder efter titlen.
  const faseOverskrifter = new Set(
    born.filter((e) => /^H[1-4]$/.test(e.tagName) && /^fase\b/i.test(tekst(e))));
  let erFaseskel;
  if (faseOverskrifter.size >= 2) {
    erFaseskel = (e) => faseOverskrifter.has(e);
  } else {
    const faseTag = ["H1", "H2", "H3"].find((t) => born.some((e) => e.tagName === t)) || null;
    erFaseskel = (e) => faseTag && e.tagName === faseTag;
  }

  const faser = [];
  let akt = null;
  const nyFase = (t) => {
    // dokument.js nummererer selv faserne — "Fase 1 — Stemthed" bliver til "Stemthed"
    const renTitel = t.replace(/^fase\s*\d+\s*[—–:.-]\s*/i, "");
    akt = { titel: renTitel, beskrivelse: "", aktiviteter: [], callouts: [] };
    faser.push(akt);
  };
  const tilfoejTekst = (t) => {
    if (!t) return;
    if (!akt) nyFase("");
    akt.beskrivelse += (akt.beskrivelse ? "\n\n" : "") + t;
  };

  for (const e of born) {
    if (erFaseskel(e)) { nyFase(tekst(e)); continue; }
    if (e.tagName === "UL" || e.tagName === "OL") {
      if (!akt) nyFase("");
      [...e.querySelectorAll(":scope > li")].forEach((li) => {
        const t = tekst(li);
        if (t) akt.aktiviteter.push(t);
      });
      continue;
    }
    if (e.tagName === "TABLE") {
      // ponytail: tabeller fladgøres til én linje pr. række — rig tabel-redigering
      // tilføjes hvis rigtige dokumenter viser behovet
      [...e.querySelectorAll("tr")].forEach((tr) => {
        const raekke = [...tr.children].map(tekst).filter(Boolean).join(" · ");
        tilfoejTekst(raekke);
      });
      continue;
    }
    tilfoejTekst(tekst(e)); // p, h-underniveauer, blockquote m.m.
  }

  return { titel, faser };
}

// ---------- minimal markdown → HTML (MinerU-output: overskrifter, lister,
// afsnit og inline HTML-tabeller — mere markdown end det behøver vi ikke) ----------

function rensInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // billeder ud
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // links → linktekst
    .replace(/\*\*|__|`/g, "")
    .trim();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdTilHtml(md) {
  const ud = [];
  let afsnit = [];
  let liste = null;
  let tabel = null;

  const luk = () => {
    if (afsnit.length) { ud.push("<p>" + esc(afsnit.join(" ")) + "</p>"); afsnit = []; }
    if (liste) { ud.push("<ul>" + liste.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>"); liste = null; }
  };

  for (const raa of md.split(/\r?\n/)) {
    const l = raa.trim();

    if (tabel) {
      tabel.push(l);
      if (/<\/table>/i.test(l)) { ud.push(tabel.join(" ")); tabel = null; }
      continue;
    }
    if (/^<table/i.test(l)) {
      luk();
      if (/<\/table>/i.test(l)) ud.push(l);
      else tabel = [l];
      continue;
    }

    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) { luk(); ud.push(`<h${h[1].length}>${esc(rensInline(h[2]))}</h${h[1].length}>`); continue; }

    const li = l.match(/^(?:[-*+]|\d+[.)])\s+(.*)/);
    if (li) { if (afsnit.length) luk(); (liste ??= []).push(rensInline(li[1])); continue; }

    if (!l) { luk(); continue; }
    if (liste) luk(); // prosa efter en liste hører til et nyt afsnit
    afsnit.push(rensInline(l));
  }
  luk();
  return ud.join("\n");
}
