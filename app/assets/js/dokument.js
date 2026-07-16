// Preview-renderer: forløbsobjekt ind, printklart dokument-DOM ud.
// renderFaseIndhold() genbruges af sequence.html, så platform-visningen og
// dokument-visningen viser samme indhold — kun rammen (chrome) omkring er forskellig.

import { DIMENSIONER, DIM_NAVNE, familieFor, datoTekst, materialetypeNavn } from "./data.js";

const CALLOUT_TITLER = {
  valg: "Didaktisk valg",
  obs: "Opmærksomhed",
  almind: "Almind: fork-invitation",
  dramaturgi: "Dramaturgisk arkitektur",
  gissel: "Materialetyper (Gissel 2026)",
};

function tekstEl(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  e.textContent = tekst; // altid textContent: kladde-data er brugerinput
  return e;
}

// Aktiviteter er {titel, beskrivelse} (Issue #22) — streng-fallback bevaret
// for kladder der endnu ikke er rørt ved siden af skema-skiftet.
function aktivitetLi(a) {
  const li = document.createElement("li");
  if (typeof a === "string") { li.textContent = a; return li; }
  if (a.titel) {
    const titelEl = document.createElement("strong");
    titelEl.className = "akt-titel";
    titelEl.textContent = a.titel + (a.beskrivelse ? ": " : "");
    li.appendChild(titelEl);
  }
  if (a.beskrivelse) li.appendChild(document.createTextNode(a.beskrivelse));
  return li;
}

// Fasens indhold (beskrivelse, aktiviteter, callouts) — delt mellem
// dokument.js's egen render (preview/print) og sequence.html, så de to
// aldrig kan drifte fra hinanden igen (skete med callouts, Issue #22-hullet).
export function renderFaseIndhold(fase, tilstand = "laerer") {
  const frag = document.createDocumentFragment();
  if (tilstand === "elev") {
    const maal = document.createElement("div");
    maal.className = "maal-boks";
    maal.innerHTML = `<strong>Efter denne fase kan du ...</strong> `;
    maal.appendChild(document.createTextNode(fase.beskrivelse));
    frag.appendChild(maal);
    if (fase.aktiviteter?.length) {
      frag.appendChild(tekstEl("h3", null, "Det skal du"));
      const ol = document.createElement("ol");
      fase.aktiviteter.forEach((a) => ol.appendChild(aktivitetLi(a)));
      frag.appendChild(ol);
    }
  } else {
    // Importeret prosa kan rumme flere afsnit — tomme linjer bliver til afsnitsskift
    (fase.beskrivelse || "").split(/\n\n+/).filter((s) => s.trim())
      .forEach((afsnit) => frag.appendChild(tekstEl("p", null, afsnit)));
    if (fase.aktiviteter?.length) {
      frag.appendChild(tekstEl("h3", null, "Bevægelser"));
      const ol = document.createElement("ol");
      fase.aktiviteter.forEach((a) => ol.appendChild(aktivitetLi(a)));
      frag.appendChild(ol);
    }
    (fase.callouts || []).forEach((c) => {
      const boks = document.createElement("aside");
      boks.className = `callout callout-${c.type}`;
      boks.appendChild(tekstEl("span", "callout-titel", c.titel || CALLOUT_TITLER[c.type] || c.type));
      boks.appendChild(document.createTextNode(c.tekst));
      frag.appendChild(boks);
    });
  }
  return frag;
}

function dgPrikker(status) {
  if (status === "fuld") return `<span class="p-fuld">&#9679;&#9679;&#9679;</span>`;
  if (status === "delvis") return `<span class="p-delvis">&#9679;&#9679;</span><span class="p-tom">&#9675;</span>`;
  return `<span class="p-delvis">&#9679;</span><span class="p-tom">&#9675;&#9675;</span>`;
}

export function renderDokument(f, tilstand = "laerer") {
  const ark = document.createElement("article");
  ark.className = "ark" + (tilstand === "elev" ? " elev" : "");
  ark.dataset.fag = familieFor(f.fag);

  // Kolofon
  const kolofon = document.createElement("header");
  kolofon.className = "ark-kolofon";
  const venstre = document.createElement("div");
  venstre.appendChild(tekstEl("span", "ark-type", tilstand === "elev" ? "Elevmateriale" : "Lærervejledning"));
  venstre.appendChild(tekstEl("h1", "ark-titel", f.titel));
  venstre.appendChild(tekstEl("div", "ark-meta",
    [f.fag, f.klassetrin, f.forfatter, f.institution, f.aar].filter(Boolean).join(" · ")));
  kolofon.appendChild(venstre);

  const dg = document.createElement("div");
  dg.className = "ark-dg";
  dg.innerHTML = DIMENSIONER.map((dim) =>
    `<div class="dg-linje">${DIM_NAVNE[dim]} <span class="prikker">${dgPrikker(f.daekningsgrad?.[dim] || "tom")}</span></div>`
  ).join("");
  dg.setAttribute("aria-label", "Didaktisk dækningsgradsprofil");
  kolofon.appendChild(dg);
  ark.appendChild(kolofon);

  if (f.beskrivelse) ark.appendChild(tekstEl("p", null, f.beskrivelse));

  // Maskinlæsbar profil fra wizard-tags (binder forløb sammen og gør dem søgbare)
  if (tilstand === "laerer" && f.tags && Object.keys(f.tags).length) {
    const dele = [];
    if (f.tags.strategi) dele.push("Planlægningsstrategi: " + f.tags.strategi);
    if (f.tags.anslag_type) dele.push("Anslag: " + f.tags.anslag_type);
    if (f.tags.virksomhedsformer?.length) dele.push("Virksomhedsformer: " + f.tags.virksomhedsformer.join(" · "));
    if (f.tags.dewey?.length) dele.push("Erfaringskvaliteter: " + f.tags.dewey.join(" · "));
    if (f.tags.evalueringsform && f.tags.evalueringsform !== "Ingen (åben plads)") dele.push("Evaluering: " + f.tags.evalueringsform);
    if (dele.length) {
      const profil = document.createElement("aside");
      profil.className = "callout callout-gissel";
      profil.appendChild(tekstEl("span", "callout-titel", "Forløbsprofil"));
      profil.appendChild(document.createTextNode(dele.join("  |  ")));
      ark.appendChild(profil);
    }
  }

  // Materialer via mitCFU (printes med: links følger dokumentet)
  if (tilstand === "laerer" && f.materialer?.length) {
    ark.appendChild(tekstEl("h3", null, "Materialer"));
    const ul = document.createElement("ul");
    f.materialer.forEach((m) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = m.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = m.titel;
      li.appendChild(a);
      // Metadata varierer med kilden: gamle materialer har type/faust,
      // schema 2-materialer har Gissel-type + evt. didaktiserings-note.
      const meta = [];
      if (m.type) meta.push(m.type);
      if (m.faust) meta.push(`mitCFU faust ${m.faust}`);
      if (m.materialetype) meta.push(materialetypeNavn(m.materialetype));
      if (meta.length) li.appendChild(document.createTextNode(` (${meta.join(", ")})`));
      if (m.didaktisering) li.appendChild(tekstEl("div", "under", "Didaktisering: " + m.didaktisering));
      ul.appendChild(li);
    });
    ark.appendChild(ul);
  }

  // Faser
  (f.faser || []).forEach((fase, i) => {
    // "Fase 1" alene hvis fasen ikke har fået sin egen titel endnu —
    // ingen tomt ": " efter tallet. Numerisk (Valdemar, 2026-07-16) — matcher
    // nu sequence.html, som allerede viste "Fase 1 af N" i stedet for bogstaver.
    ark.appendChild(tekstEl("h2", null,
      fase.titel ? `Fase ${i + 1}: ${fase.titel}` : `Fase ${i + 1}`));
    ark.appendChild(renderFaseIndhold(fase, tilstand));
  });

  // Wizard-refleksioner (kladder): lærerens egne svar som valg-callouts
  if (tilstand === "laerer" && f.refleksioner?.length) {
    ark.appendChild(tekstEl("h2", null, "Didaktiske refleksioner"));
    f.refleksioner.forEach((r) => {
      const boks = document.createElement("aside");
      boks.className = "callout callout-valg";
      boks.appendChild(tekstEl("span", "callout-titel", r.kilde));
      boks.appendChild(document.createTextNode(r.tekst));
      ark.appendChild(boks);
    });
  }

  // Åbne pladser: printes med. Invitationen følger materialet ud af platformen.
  if (tilstand === "laerer" && f.tomme_pladser?.length) {
    f.tomme_pladser.forEach((p) => {
      const boks = document.createElement("aside");
      boks.className = "aaben-plads-boks";
      boks.appendChild(tekstEl("span", "boks-titel",
        `Til dig der overtager forløbet: ${DIM_NAVNE[p.dimension] || p.dimension} er en åben plads`));
      boks.appendChild(document.createTextNode(p.besked));
      ark.appendChild(boks);
    });
  }

  // Fod
  const fod = document.createElement("footer");
  fod.className = "ark-fod";
  fod.innerHTML = `<span>Almind · ${datoTekst(f.opdateret || new Date().toISOString())}</span><span>${f.licens || "CC BY-SA 4.0"}</span>`;
  ark.appendChild(fod);

  return ark;
}
