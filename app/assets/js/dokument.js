// Preview-renderer: forløbsobjekt ind, printklart dokument-DOM ud.
// renderFaseIndhold() genbruges af sequence.html, så platform-visningen og
// dokument-visningen viser samme indhold — kun rammen (chrome) omkring er forskellig.

import { DIMENSIONER, DIM_NAVNE, familieFor, datoTekst, hentFag, treklangKendetegn } from "./data.js";
import { medietype, medieElement, medieFacade, renseUrl } from "./medie.js";
import { faseTidTekst, faseKontekstTekst, forloebOmfangTekst, faseDramaturgiTekst, dramaturgiUnion } from "./komponenter.js";

const LEKTIONSLAENGDE_KEY = "almind.lektionslaengde";
function hentLektionslaengde() {
  const v = Number(localStorage.getItem(LEKTIONSLAENGDE_KEY));
  return [45, 60, 90].includes(v) ? v : 45;
}

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
    // Anslaget (#136): fasens åbning vises øverst som dramaturgi-callout —
    // "vises på forløbets side" (FASE_PROFIL-løftet) opfyldes her, delt
    // mellem preview/print og sequence.
    if (fase.anslag_tekst) {
      const boks = document.createElement("aside");
      boks.className = "callout callout-dramaturgi";
      boks.appendChild(tekstEl("span", "callout-titel",
        "Anslag" + (fase.anslag_type ? `: ${fase.anslag_type}` : "")));
      boks.appendChild(document.createTextNode(fase.anslag_tekst));
      frag.appendChild(boks);
    }
    // Importeret prosa kan rumme flere afsnit — tomme linjer bliver til afsnitsskift
    (fase.beskrivelse || "").split(/\n\n+/).filter((s) => s.trim())
      .forEach((afsnit) => frag.appendChild(tekstEl("p", null, afsnit)));
    // almind-dev#113: elevmaal vist også i lærer-tilstand — elevmaterialets
    // løfte, dæmpet og indrammet, adskilt fra elevens egen grønne maal-boks
    // (§8.2 i elevmateriale-arkitektur-plan.md). Samme data, anden ramme.
    if (fase.elevmaal?.length) {
      const loefte = document.createElement("div");
      loefte.className = "elevmaal-loefte";
      loefte.appendChild(tekstEl("span", "elevmaal-loefte-label", "Elevmål for fasen"));
      const ul = document.createElement("ul");
      fase.elevmaal.forEach((m) => ul.appendChild(tekstEl("li", null, m)));
      loefte.appendChild(ul);
      frag.appendChild(loefte);
    }
    if (fase.aktiviteter?.length) {
      frag.appendChild(tekstEl("h3", null, "Bevægelser"));
      const ol = document.createElement("ol");
      fase.aktiviteter.forEach((a) => ol.appendChild(aktivitetLi(a)));
      frag.appendChild(ol);
    }
    // Fase-materialer (#135): kun lærer-flader indtil P4 afgør elev-placeringen
    // (beslutningsnotens fravalg 4) — derfor ingen elev-gren her endnu.
    if (fase.materialer?.length) {
      frag.appendChild(tekstEl("h3", null, "Materialer"));
      frag.appendChild(materialeListe(fase.materialer, tilstand));
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
export function renderForloebsoversigt(f, tilstand = "laerer") {
  const faser = f.faser;
  if (!faser?.length || faser.length < 2) return null;
  const wrap = document.createElement("nav");
  wrap.className = "forloeb-oversigt";
  wrap.setAttribute("aria-label", "Forløbsoversigt");
  wrap.appendChild(tekstEl("span", "forloeb-oversigt-titel", "Forløbet i overblik"));
  const ol = document.createElement("ol");
  faser.forEach((fase, i) => {
    // Design-opfølgning 2026-07-24: kort, ikke kolonner/liste — egen
    // komposition, adskilt fra fase-hoved-boksen (bevidst, Valdemar: "ikke et
    // kæmpe problem at det renderes lidt anderledes"). Rad: Fase N · sted ·
    // tid, tæt sammen (mono, alle tre — sted er en kort stedbetegnelse her,
    // ikke lang prosa). Titel (fed) og dramaturgi (Jost) derunder, i den
    // rækkefølge — titlen ALENE, uden "Fase N:"-præfiks.
    const li = document.createElement("li");
    const rad = document.createElement("div");
    rad.className = "fase-oversigt-rad";
    rad.appendChild(tekstEl("span", "fase-nr", `Fase ${i + 1}`));
    const kontekst = faseKontekstTekst(fase);
    if (kontekst) rad.appendChild(tekstEl("span", "fase-oversigt-sted", kontekst));
    const tid = faseTidTekst(fase);
    if (tid) rad.appendChild(tekstEl("span", "fase-varighed-badge", tid));
    li.appendChild(rad);
    const a = document.createElement("a");
    a.href = `#fase-${i + 1}`;
    a.textContent = fase.titel || `Fase ${i + 1}`;
    li.appendChild(a);
    if (tilstand === "laerer") {
      const dram = faseDramaturgiTekst(fase);
      if (dram) li.appendChild(tekstEl("div", "fase-dramaturgi-linje", dram));
    }
    ol.appendChild(li);
  });
  wrap.appendChild(ol);

  // Forløbstotal + lektionslængde-vælger: kun forløbsniveau, aldrig lektionstal
  // pr. fase (se beslutning fase-lektion-tidsestimat, punkt 3).
  const fuldDaekning = faser.every((fa) => fa.minutter_min != null);
  const totalRaekke = document.createElement("div");
  totalRaekke.className = "forloeb-omfang-raekke";
  const totalEl = tekstEl("span", "forloeb-omfang-total");
  const vaelger = document.createElement("select");
  vaelger.className = "forloeb-lektionslaengde";
  vaelger.setAttribute("aria-label", "Lektionslængde");
  [45, 60, 90].forEach((min) => vaelger.appendChild(new Option(`${min} min/lektion`, min)));
  function opdaterTotal() {
    const L = hentLektionslaengde();
    vaelger.value = String(L);
    const tekst = forloebOmfangTekst(f, L);
    totalEl.textContent = tekst;
    totalRaekke.hidden = !tekst;
    vaelger.hidden = !fuldDaekning;
  }
  vaelger.addEventListener("change", () => {
    localStorage.setItem(LEKTIONSLAENGDE_KEY, vaelger.value);
    opdaterTotal();
  });
  opdaterTotal();
  totalRaekke.append(totalEl, vaelger);
  wrap.appendChild(totalRaekke);

  return wrap;
}

// Fase-hoved (design-opfølgning 2026-07-23): meta-rækken (Fase N/dramaturgi/
// tid+sted) + titlen alene, centreret, nedenunder. Tid og sted hører sammen
// (begge logistik: hvor længe, hvor/hvornår) og stables derfor i samme
// højrestillede søjle — sted forbliver prosa/kursiv (#128: nogle kontekst-
// tekster er hele sætninger, ikke tags), kun tid er mono/data. Delt mellem
// dokument.js og sequence.html — samme mønster som renderFaseIndhold/
// renderForloebsoversigt (én kilde, ingen drift, jf. #22-hullet). Boksens id
// giver deep-link-ankeret (#51); meta/h2 er søskende, ikke indhold-i-indhold
// — print's string-set (#52) fanger derfor kun titlens egen tekst.
export function renderFaseHoved(fase, i, tilstand = "laerer") {
  const hoved = document.createElement("div");
  hoved.className = "fase-hoved-boks";
  hoved.id = `fase-${i + 1}`;
  hoved.appendChild(tekstEl("h2", null, fase.titel || `Fase ${i + 1}`));
  const meta = document.createElement("div");
  meta.className = "fase-hoved-meta";
  meta.appendChild(tekstEl("span", "fase-nr", `Fase ${i + 1}`));
  if (tilstand === "laerer") {
    const dram = faseDramaturgiTekst(fase);
    if (dram) meta.appendChild(tekstEl("span", "fase-dramaturgi-linje", dram));
  }
  const tid = faseTidTekst(fase);
  const kontekst = faseKontekstTekst(fase);
  if (tid || kontekst) {
    const tidSted = document.createElement("div");
    tidSted.className = "fase-hoved-tid-sted";
    if (tid) tidSted.appendChild(tekstEl("span", "fase-varighed-badge", tid));
    if (kontekst) tidSted.appendChild(tekstEl("span", "fase-kontekst", kontekst));
    meta.appendChild(tidSted);
  }
  hoved.appendChild(meta);
  return hoved;
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
    // Design-opfølgning 2026-07-24: faust-nr og Gissel-materialetype droppet
    // fra visningen — faust er redundant når materialet allerede er et link
    // (og for mitCFU er det ligefrem en del af URL'en), materialetypen er
    // forfatterens egen kategorisering, ikke noget en læser har brug for her.
    // Typen (fx "Bog") er stadig værd at vise — kort label før titlen.
    if (m.type) li.appendChild(tekstEl("span", "materiale-type", m.type + ": "));
    const a = document.createElement("a");
    a.href = renseUrl(m.url); a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = m.titel;
    li.appendChild(a);
    // almind-dev#139: forfatter var før fanget i fritekst-note (fx "Adam O., 2025. ...")
    if (m.forfatter) li.appendChild(tekstEl("span", "materiale-forfatter", " | " + m.forfatter));
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

// #59: legitimeringsafsnittet (W4/#58's treklang-gave) — Valdemar-godkendt
// copy-skabelon 2026-07-23. Placeres ved Fagplan-koblingen: begge handler om
// at forankre forløbet i fagplan/formål, samme kolofon-udvidelses-nabolag.
// Tomt treklang-felt (ingen kendetegn, ingen hvordan) = intet output — samme
// invitations-princip som resten af de didaktiske felter.
export async function renderTreklang(f) {
  const valgteIder = f.treklang?.kendetegn || [];
  const hvordan = (f.treklang?.hvordan || "").trim();
  if (!valgteIder.length && !hvordan) return null;
  const alle = await treklangKendetegn().catch(() => []);
  const valgte = valgteIder.map((id) => alle.find((k) => k.id === id)).filter(Boolean);
  if (!valgte.length && !hvordan) return null;

  const wrap = document.createElement("div");
  wrap.className = "treklang-legitimering";
  wrap.appendChild(tekstEl("h2", null, "Hvorfor dette forløb er vigtigt"));
  if (valgte.length) {
    const ben = [...new Set(valgte.map((k) => k.ben))];
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(
      `Forløbet bærer ${valgte.length} af de ti kendetegn på alsidig undervisning: `));
    p.appendChild(tekstEl("strong", null, valgte.map((k) => k.navn).join(" · ")));
    p.appendChild(document.createTextNode(
      `. Dermed bidrager det især til ${ben.join(" · ")}, treklangen der binder fagplanen til folkeskolens formål.`));
    wrap.appendChild(p);
  }
  if (hvordan) wrap.appendChild(tekstEl("p", "treklang-hvordan", hvordan));
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
  venstre.className = "ark-kolofon-tekst";
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
    const oversigt = renderForloebsoversigt(f, tilstand);
    if (oversigt) ark.appendChild(oversigt);
  }

  // Maskinlæsbar profil: dramaturgi-delene beregnes nu som union af fase-tags
  // med legacy-forløbs-tags som fallback (#136, dramaturgiUnion) — strategi/
  // evaluering er fortsat forløbs-tags.
  if (tilstand === "laerer") {
    const dram = dramaturgiUnion(f);
    const dele = [];
    if (f.tags?.strategi) dele.push("Planlægningsstrategi: " + f.tags.strategi);
    if (dram.anslag_type) dele.push("Anslag: " + dram.anslag_type);
    if (dram.virksomhedsformer.length) dele.push("Virksomhedsformer: " + dram.virksomhedsformer.join(" · "));
    if (dram.dewey.length) dele.push("Erfaringskvaliteter: " + dram.dewey.join(" · "));
    if (f.tags?.evalueringsform && f.tags.evalueringsform !== "Ingen (åben plads)") dele.push("Evaluering: " + f.tags.evalueringsform);
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

  // Faser. #51: id på fase-hoved-boksen giver et deep-link-anker (elev.html#fase-1)
  // — scroll-margin-top under den sticky header sættes i CSS (.fase-hoved-boks).
  // almind-dev#112: forløb helt uden elevindhold viser kun tom-tilstanden ovenfor.
  (elevHarIndhold ? (f.faser || []) : []).forEach((fase, i) => {
    // #128/design-opfølgning 2026-07-23: sted/kontekst bor nu i fase-hoved-
    // boksen selv, stablet under tid (renderFaseHoved) — de to er begge
    // fasens logistik (hvor længe, hvor/hvornår).
    ark.appendChild(renderFaseHoved(fase, i, tilstand));
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

  if (tilstand === "laerer") {
    const treklang = await renderTreklang(f);
    if (treklang) ark.appendChild(treklang);
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
