// Preview-renderer: forløbsobjekt ind, printklart dokument-DOM ud.
// renderFaseIndhold() genbruges af sequence.html, så platform-visningen og
// dokument-visningen viser samme indhold — kun rammen (chrome) omkring er forskellig.

import { DIMENSIONER, DIM_NAVNE, familieFor, datoTekst, materialetypeNavn, hentFag } from "./data.js";
import { medietype, medieElement, medieFacade, renseUrl } from "./medie.js";

const CALLOUT_TITLER = {
  valg: "Didaktisk valg",
  obs: "Opmærksomhed",
  almind: "Almind: fork-invitation",
  dramaturgi: "Dramaturgisk arkitektur",
  gissel: "Materialetyper (Gissel 2026)",
  tip: "Tip",
  opgave: "Opgave",
  regel: "Regel",
};

// almind-dev#112: en fase har elevindhold når mindst ét af de fire elevfelter
// er udfyldt — bruges til fallback-hierarkiet (fase-niveau og forløbs-niveau).
export function harElevIndholdFase(fase) {
  return !!(fase.elevmaal?.length || fase.elevtekst || fase.elevaktiviteter?.length || fase.elevbokse?.length);
}
export function harElevIndhold(f) {
  return !!(f.elevintro || (f.faser || []).some(harElevIndholdFase));
}

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
    // almind-dev#112: eleven ser aldrig lærerens register uden forfatterens
    // aktive valg — en fase uden elevindhold får en neutral linje, ikke
    // lærerens beskrivelse i en "Efter denne fase kan du ..."-indpakning.
    if (!harElevIndholdFase(fase)) {
      frag.appendChild(tekstEl("p", "fase-elev-neutral", "Din lærer sætter jer i gang med denne fase."));
      return frag;
    }
    if (fase.elevmaal?.length) {
      const maal = document.createElement("div");
      maal.className = "maal-boks";
      maal.appendChild(tekstEl("strong", null, "Efter denne fase kan du ..."));
      const ul = document.createElement("ul");
      fase.elevmaal.forEach((m) => ul.appendChild(tekstEl("li", null, m)));
      maal.appendChild(ul);
      frag.appendChild(maal);
    }
    if (fase.elevtekst) {
      fase.elevtekst.split(/\n\n+/).filter((s) => s.trim())
        .forEach((afsnit) => frag.appendChild(tekstEl("p", null, afsnit)));
    }
    if (fase.elevaktiviteter?.length) {
      frag.appendChild(tekstEl("h3", null, "Det skal du"));
      const ol = document.createElement("ol");
      fase.elevaktiviteter.forEach((a) => ol.appendChild(aktivitetLi(a)));
      frag.appendChild(ol);
    }
    (fase.elevbokse || []).forEach((b) => {
      const boks = document.createElement("aside");
      boks.className = `callout callout-${b.type}`;
      boks.appendChild(tekstEl("span", "callout-titel", b.titel || CALLOUT_TITLER[b.type] || b.type));
      boks.appendChild(document.createTextNode(b.tekst));
      frag.appendChild(boks);
    });
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

// Forløbsoversigt: fase → titel → varighed, ét overblik før detaljerne.
// Delt mellem dokument.js's egen render (preview/print) og sequence.html,
// samme mønster som renderFaseIndhold — ingen ny CSS, genbruger
// fase-varighed-badge. Vises kun ved 2+ faser (ved 1 fase er overblikket
// selve siden). Samme skelet i begge tilstande (titel+varighed er delt,
// jf. elevmateriale-arkitektur-plan.md §2) — kun overskriften varierer.
export function renderForloebsoversigt(faser, tilstand = "laerer") {
  if (!faser?.length || faser.length < 2) return null;
  const wrap = document.createElement("nav");
  wrap.className = "forloeb-oversigt";
  wrap.setAttribute("aria-label", "Forløbsoversigt");
  wrap.appendChild(tekstEl("span", "forloeb-oversigt-titel", "Forløbet i overblik"));
  const ol = document.createElement("ol");
  faser.forEach((fase, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#fase-${i + 1}`;
    a.textContent = fase.titel ? `Fase ${i + 1}: ${fase.titel}` : `Fase ${i + 1}`;
    li.appendChild(a);
    if (fase.varighed) li.appendChild(tekstEl("span", "fase-varighed-badge", fase.varighed));
    ol.appendChild(li);
  });
  wrap.appendChild(ol);
  return wrap;
}

function dgPrikker(status) {
  if (status === "fuld") return `<span class="p-fuld">&#9679;&#9679;&#9679;</span>`;
  if (status === "delvis") return `<span class="p-delvis">&#9679;&#9679;</span><span class="p-tom">&#9675;</span>`;
  return `<span class="p-delvis">&#9679;</span><span class="p-tom">&#9675;&#9675;</span>`;
}

// #52: rendering udledes af URL'en (medietype()), intet nyt felt. Lærerflade
// (sequence/preview/print) indlæser direkte; elevflade viser en click-to-load-
// facade — intet tredjeparts-kald før eleven selv klikker (arkitektur 1.4/2.2).
function materialeListe(materialer, tilstand) {
  const ul = document.createElement("ul");
  materialer.forEach((m) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = renseUrl(m.url); a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = m.titel;
    li.appendChild(a);
    const meta = [];
    if (m.type) meta.push(m.type);
    if (m.faust) meta.push(`mitCFU faust ${m.faust}`);
    if (m.materialetype) meta.push(materialetypeNavn(m.materialetype));
    if (meta.length) li.appendChild(document.createTextNode(` (${meta.join(", ")})`));
    if (m.didaktisering) li.appendChild(tekstEl("div", "under", "Didaktisering: " + m.didaktisering));
    const type = medietype(m.url);
    if (type !== "link") {
      const wrap = document.createElement("div");
      wrap.className = "medie-indlejring";
      wrap.appendChild(tilstand === "elev" ? medieFacade(m, type) : medieElement(m, type));
      li.appendChild(wrap);
    }
    ul.appendChild(li);
  });
  return ul;
}

// #113/§8.1-opfølgning: eksemplarisk_centrum, fravalg, didaktisk_position og
// fagplan_ref havde ingen print/preview-forbruger — kun sequence.html's E.6-
// paneler viste dem. renderDokument er derfor async (fagplan-koblingen slår
// fagfilen op for indholdsområde- og målnavne, samme kilde som sequence.html).
function ekAfsnit(label, tekst) {
  const p = document.createElement("p");
  p.appendChild(tekstEl("span", "ek-label", label));
  p.appendChild(document.createTextNode(tekst));
  return p;
}

// #113/§8.1: fagplan-kobling — indholdsområdenavne + de valgte måls fulde tekst,
// slået op i fagfilen. Delt mellem dokument.js og sequence.html (samme mønster
// som renderFaseIndhold/renderForloebsoversigt), så begge flader viser samme
// kobling. Returnerer null hvis intet er koblet, eller fagfilen ikke kan hentes.
export async function renderFagplanKobling(f) {
  if (!f.fagplan_ref?.indholdsomraader?.length) return null;
  const fagFil = await hentFag(f.fag).catch(() => null);
  if (!fagFil?.indholdsomraader) return null;
  const wrap = document.createElement("div");
  wrap.appendChild(tekstEl("p", "under", `${fagFil.navn} · fagplan ${f.fagplan_ref.version || fagFil.fagplan_version}`));
  const ul = document.createElement("ul");
  f.fagplan_ref.indholdsomraader.forEach((id) => {
    const omr = fagFil.indholdsomraader.find((o) => o.id === id);
    if (!omr) return;
    const li = document.createElement("li");
    li.appendChild(tekstEl("strong", null, omr.navn));
    const maal = (omr.maal || []).filter((m) => f.fagplan_ref.maal?.includes(m.id));
    if (maal.length) {
      const maalUl = document.createElement("ul");
      maal.forEach((m) => maalUl.appendChild(tekstEl("li", null, m.sigte)));
      li.appendChild(maalUl);
    }
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  return wrap;
}

export async function renderDokument(f, tilstand = "laerer") {
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

  // #50: dækningsgraden er forfatterens selvevaluering, ikke elevrettet indhold —
  // vises kun i lærertilstanden (whitelist-filteret i elev.html/elev-fanen).
  if (tilstand === "laerer") {
    const dg = document.createElement("div");
    dg.className = "ark-dg";
    dg.innerHTML = DIMENSIONER.map((dim) =>
      `<div class="dg-linje">${DIM_NAVNE[dim]} <span class="prikker">${dgPrikker(f.daekningsgrad?.[dim] || "tom")}</span></div>`
    ).join("");
    dg.setAttribute("aria-label", "Didaktisk dækningsgradsprofil");
    kolofon.appendChild(dg);
  }
  ark.appendChild(kolofon);

  // almind-dev#112: beskrivelse er lærervendt ("Din klasse skal ..."), elevintro
  // er elevens egen åbning — de to felter viser aldrig samtidig.
  if (tilstand === "laerer" && f.beskrivelse) ark.appendChild(tekstEl("p", null, f.beskrivelse));

  const elevHarIndhold = tilstand === "elev" ? harElevIndhold(f) : true;
  if (tilstand === "elev" && !elevHarIndhold) {
    ark.appendChild(tekstEl("aside", "tom-tilstand",
      "Dette forløb har endnu ikke et elevmateriale. Din lærer fortæller jer, hvad der skal ske — eller også er du læreren: skriv elevversionen i editoren."));
  }
  if (tilstand === "elev" && elevHarIndhold && f.elevintro) {
    f.elevintro.split(/\n\n+/).filter((s) => s.trim())
      .forEach((afsnit) => ark.appendChild(tekstEl("p", null, afsnit)));
  }

  // Eksemplarisk centrum: lærer-tilstand kun — "det konkrete/det almene" er
  // Klafki-teorivokabular (Design Principle 4), ikke elevrettet. sequence.html
  // er altid lærersiden (elev.html er en helt separat side), så placeringen
  // (før faser) matcher stadig — kun tilstandsfilteret var forkert.
  if (tilstand === "laerer" && (f.eksemplarisk_centrum?.konkret || f.eksemplarisk_centrum?.alment)) {
    ark.appendChild(tekstEl("h2", null, "Eksemplarisk centrum"));
    if (f.eksemplarisk_centrum.konkret) ark.appendChild(ekAfsnit("Det konkrete", f.eksemplarisk_centrum.konkret));
    if (f.eksemplarisk_centrum.alment) ark.appendChild(ekAfsnit("Det almene", f.eksemplarisk_centrum.alment));
  }

  // Forløbsoversigt: roadmap lige før faserne, i begge tilstande (skelettet
  // er delt — se elevmateriale-arkitektur-plan.md §2/§8.3).
  const oversigtVis = tilstand === "elev" ? elevHarIndhold : true;
  if (oversigtVis) {
    const oversigt = renderForloebsoversigt(f.faser, tilstand);
    if (oversigt) ark.appendChild(oversigt);
  }

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

  // Materialer via mitCFU (printes med: links følger dokumentet). Elevtilstand
  // viser kun de materialer forfatteren har markeret "Vises for elever" (#50).
  if (tilstand === "laerer" && f.materialer?.length) {
    ark.appendChild(tekstEl("h3", null, "Materialer"));
    ark.appendChild(materialeListe(f.materialer, tilstand));
  } else if (tilstand === "elev" && f.materialer?.some((m) => m.elev)) {
    ark.appendChild(tekstEl("h3", null, "Materialer"));
    ark.appendChild(materialeListe(f.materialer.filter((m) => m.elev), tilstand));
  }

  // Faser. #51: id på overskriften giver et deep-link-anker (elev.html#fase-1)
  // — scroll-margin-top under den sticky header sættes i CSS (.ark h2).
  // almind-dev#112: forløb helt uden elevindhold viser kun tom-tilstanden ovenfor.
  (elevHarIndhold ? (f.faser || []) : []).forEach((fase, i) => {
    // "Fase 1" alene hvis fasen ikke har fået sin egen titel endnu —
    // ingen tomt ": " efter tallet. Numerisk (Valdemar, 2026-07-16) — matcher
    // nu sequence.html, som allerede viste "Fase 1 af N" i stedet for bogstaver.
    const h2 = tekstEl("h2", null, fase.titel ? `Fase ${i + 1}: ${fase.titel}` : `Fase ${i + 1}`);
    h2.id = `fase-${i + 1}`;
    ark.appendChild(h2);
    // #52-opfølgning: varighed uden for h2'en med vilje — den fanges ellers med
    // i print's string-set (løbende sidehoved), som kun skal bære faseTITLEN.
    if (fase.varighed) ark.appendChild(tekstEl("div", "fase-varighed-badge", fase.varighed));
    ark.appendChild(renderFaseIndhold(fase, tilstand));
  });

  // Kolofon-udvidelser: fravalg, position, fagplan-kobling. Kun lærer-tilstand
  // (teorivokabular er forfattersprog, Design Principle 4) — placeret her, EFTER
  // faser, jf. Design Principle 1 ("dækningsgrad, fravalg ... er kolofon, ikke
  // forside"): på sequence.html bor de i aside-panelerne ved siden af faserne;
  // i det lineære dokument bliver "ved siden af" til "bagest".
  if (tilstand === "laerer" && f.fravalg?.length) {
    ark.appendChild(tekstEl("h2", null, "Bevidste fravalg"));
    const ul = document.createElement("ul");
    f.fravalg.forEach((fv) => {
      const li = document.createElement("li");
      li.appendChild(tekstEl("strong", null, fv.hvad));
      li.appendChild(document.createTextNode(" " + fv.hvorfor));
      ul.appendChild(li);
    });
    ark.appendChild(ul);
  }

  if (tilstand === "laerer" && (f.didaktisk_position?.fagsyn || f.didaktisk_position?.laeringssyn)) {
    ark.appendChild(tekstEl("h2", null, "Forfatterens position"));
    if (f.didaktisk_position.fagsyn) ark.appendChild(ekAfsnit("Fagsyn", f.didaktisk_position.fagsyn));
    if (f.didaktisk_position.laeringssyn) ark.appendChild(ekAfsnit("Læringssyn", f.didaktisk_position.laeringssyn));
  }

  if (tilstand === "laerer" && f.fagplan_ref?.indholdsomraader?.length) {
    const kobling = await renderFagplanKobling(f);
    if (kobling) {
      ark.appendChild(tekstEl("h2", null, "Fagplan-kobling"));
      ark.appendChild(kobling);
    }
  }

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
  fod.appendChild(tekstEl("span", null, `Almind · ${datoTekst(f.opdateret || new Date().toISOString())}`));
  fod.appendChild(tekstEl("span", null, f.licens || "CC BY-SA 4.0"));
  ark.appendChild(fod);

  return ark;
}
