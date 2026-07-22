// Blok-editor: forløbsobjektet ER editorens tilstand.
// Blokkene er 1:1 med forloeb.json-skemaet (faser, aktiviteter, callouts,
// materialer, åbne pladser) — ingen mapping, intet eget dokumentformat.
// Tekstfelter binder direkte til objektet; kun strukturændringer
// (tilføj/slet/træk) gentegner kanvassen, så fokus aldrig mistes under skrivning.
// Drag-to-reorder: SortableJS (loades som script-tag af rediger.html).

import {
  DIMENSIONER, DIM_NAVNE, familieFor, SAMSPIL_FORMER, tegnFagOptions,
  hentManifest, hentDestillat, hentFagIndex, hentFag, gemKladde, gisselMaterialetyper,
  hentBegreber, begrebMatchNoegle,
} from "./data.js";
import { PROFIL_GRUPPER, klasseValgFor, kildeIkon } from "./wizard.js";
import { GREB_KATALOG } from "./greb-katalog.js";
import { harElevIndhold, harElevIndholdFase } from "./dokument.js";

const CALLOUT_TYPER = {
  valg: "Didaktisk valg",
  obs: "Opmærksomhed",
  almind: "Almind: fork-invitation",
  dramaturgi: "Dramaturgisk arkitektur",
  gissel: "Materialetyper (Gissel)",
};

const ELEVBOKS_TYPER = { tip: "Tip", opgave: "Opgave", regel: "Regel" };

// Fritekst-svar fra profilen gemmes som refleksioner (samme som wizardens afslut)
const REFLEKSION_KILDER = { anslag_tekst: "Anslag", didaktiseres_selv: "Didaktisering" };

const iDag = () => new Date().toISOString().slice(0, 10);

// forceFallback: SortableJS' egen drag-motor frem for native HTML5-drag —
// ens opførsel på desktop, touch og Safari, og ghost-stilen kan styles
const DRAG = { animation: 150, forceFallback: true, fallbackTolerance: 4 };

export function nytForloeb() {
  return {
    id: "kladde", schema_version: 3, titel: "", undertitel: null, forfatter: "Dig", institution: "Din skole",
    aar: new Date().getFullYear(), fag: "dansk", klassetrin: "", licens: "CC BY-SA 4.0",
    omfang: null, eksemplarisk_centrum: null, fravalg: [], didaktisk_position: null,
    fagplan_ref: null, samspil: null,
    opdateret: iDag(), fork_af: null, forks: [], beskrivelse: "", tags: {},
    daekningsgrad: Object.fromEntries(DIMENSIONER.map((d) => [d, "fuld"])),
    tomme_pladser: [], faser: [], materialer: [], refleksioner: [],
  };
}

export function forkAf(original) {
  const f = structuredClone(original);
  f.id = "kladde";
  f.fork_af = { id: original.id, opdateret: original.opdateret };
  f.forks = [];
  f.generation = (original.generation ?? 0) + 1;
  f.undertitel = "Fork af " + (original.undertitel || original.titel);
  f.forfatter = "Dig";
  f.institution = "Din skole";
  f.aar = new Date().getFullYear();
  f.opdateret = iDag();
  delete f.diff;
  delete f.citat;
  return f;
}

// Publish-gate (arkitektur 1.2): §2-håndhævelsen flytter til delingsøjeblikket.
// Kaldes af rediger.html FØR delTilAlmind/gemTilEgenGren — ikke ved indgang.
export function centrumOK(f) {
  return !!(f.eksemplarisk_centrum?.konkret?.trim() && f.eksemplarisk_centrum?.alment?.trim());
}

export function aabnCentrumDialog(f, gemKladdeFn) {
  return new Promise((resolve) => {
    f.eksemplarisk_centrum ??= { konkret: "", alment: "" };
    const c = f.eksemplarisk_centrum;

    const dlg = document.createElement("dialog");
    dlg.className = "greb-dialog centrum-dialog";
    const h2 = document.createElement("h2");
    h2.textContent = "Før forløbet deles";
    dlg.appendChild(h2);
    const intro = document.createElement("p");
    intro.className = "under";
    intro.textContent = "Hvad fordyber eleverne sig i — og hvad åbner det?";
    dlg.appendChild(intro);

    const fortsaet = document.createElement("button");
    let dialogFeltId = 0;
    function felt(label, vaerdi, placeholder, onInput) {
      const wrap = document.createElement("div");
      wrap.className = "felt";
      const l = document.createElement("span");
      l.className = "felt-label";
      l.id = `centrum-dialog-label-${dialogFeltId++}`;
      l.textContent = label;
      wrap.appendChild(l);
      const ta = document.createElement("textarea");
      ta.className = "tekstfelt";
      ta.value = vaerdi || "";
      ta.placeholder = placeholder;
      ta.setAttribute("aria-labelledby", l.id);
      ta.addEventListener("input", () => { onInput(ta.value); fortsaet.disabled = !centrumOK(f); });
      wrap.appendChild(ta);
      return wrap;
    }

    dlg.appendChild(felt(
      "Det konkrete: hvilket stof, værk eller fænomen står i centrum?",
      c.konkret,
      "fx \"Tove Ditlevsens 'Barndommens gade'\" eller \"gær der hæver dej\"",
      (v) => (c.konkret = v),
    ));
    dlg.appendChild(felt(
      "Det almene: hvilken større indsigt er stoffet et eksempel på?",
      c.alment,
      "fx \"hvordan litteratur giver sprog til klasse og opvækst\" eller \"at mikroorganismer omsætter stof\"",
      (v) => (c.alment = v),
    ));

    fortsaet.type = "button";
    fortsaet.className = "tilfoej";
    fortsaet.textContent = "Udfyld og fortsæt";
    fortsaet.disabled = !centrumOK(f);
    fortsaet.addEventListener("click", () => {
      if (!centrumOK(f)) return;
      gemKladdeFn(f);
      dlg.close(); dlg.remove();
      resolve(true);
    });
    dlg.appendChild(fortsaet);

    const annuller = document.createElement("button");
    annuller.type = "button";
    annuller.className = "tilfoej";
    annuller.textContent = "Annullér";
    annuller.addEventListener("click", () => { dlg.close(); dlg.remove(); resolve(false); });
    dlg.appendChild(annuller);

    dlg.addEventListener("close", () => resolve(false));
    dlg.addEventListener("close", () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

export async function startEditor({ kanvas, panel, f, fokusDimension = null }) {
  f.faser ??= []; f.tomme_pladser ??= []; f.materialer ??= [];
  f.refleksioner ??= []; f.tags ??= {}; f.daekningsgrad ??= {};

  // Fag fra fag-index (26, ikke 12 hardcodede) og Gissel-typer fra destillatet
  // — hentes én gang her, så kanvas-tegningen kan forblive synkron.
  const fagIndex = await hentFagIndex();
  const gisselTyper = await gisselMaterialetyper().catch(() => []);

  let feltId = 0; // unikt id-suffiks til felt-label-spans, så aria-labelledby kan pege på dem
  let tilstand = "laerer"; // almind-dev#112: fladeskifter — spejler preview.html's faner
  let gemT = null;
  const gem = () => {
    clearTimeout(gemT);
    gemT = setTimeout(() => { f.opdateret = iDag(); gemKladde(f); }, 250);
  };

  // ---------- småhjælpere ----------

  function el(tag, klasse, tekst) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst != null) e.textContent = tekst; // altid textContent: alt er brugerinput
    return e;
  }

  function inputFelt(klasse, vaerdi, placeholder, onInput) {
    const i = el("input", klasse);
    i.type = "text";
    i.value = vaerdi || "";
    i.placeholder = placeholder || "";
    i.addEventListener("input", () => { onInput(i.value); gem(); });
    return i;
  }

  function tekstFelt(klasse, vaerdi, placeholder, onInput) {
    const t = el("textarea", klasse);
    t.value = vaerdi || "";
    t.placeholder = placeholder || "";
    const voks = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
    t.addEventListener("input", () => { onInput(t.value); gem(); voks(); });
    setTimeout(voks, 0); // kører først når feltet er sat ind i DOM'en af kalderen
    return t;
  }

  function sletKnap(titel, onClick) {
    const b = el("button", "blok-slet", "×");
    b.type = "button";
    b.title = titel;
    b.setAttribute("aria-label", titel);
    b.addEventListener("click", onClick);
    return b;
  }

  function haandtag() {
    const h = el("span", "haandtag", "⠿");
    h.title = "Træk for at flytte";
    h.setAttribute("aria-hidden", "true");
    return h;
  }

  function tilfoejKnap(tekst, onClick) {
    const b = el("button", "tilfoej", tekst);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  // ---------- kanvas ----------

  // almind-dev#112 Greb 1: fladeskifter der spejler preview.html's faner.
  // Elevtilstand deler skelettet (grundinfo, fase-rammer) med lærertilstanden,
  // men viser elevfelterne i stedet for lærerens — se tegnGrundinfo/tegnFase.
  function tegnFladeskifter() {
    const faner = el("div", "faner");
    faner.setAttribute("role", "tablist");
    faner.setAttribute("aria-label", "Redigér som");
    [["laerer", "Lærervejledning"], ["elev", "Elevmateriale"]].forEach(([v, navn]) => {
      const b = el("button", "fane", navn);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(tilstand === v));
      b.addEventListener("click", () => { tilstand = v; tegnKanvas(); });
      faner.appendChild(b);
    });
    return faner;
  }

  function tegnKanvas() {
    kanvas.innerHTML = "";
    kanvas.appendChild(tegnFladeskifter());
    kanvas.appendChild(tegnGrundinfo());
    kanvas.appendChild(tegnFaser());
    if (tilstand === "laerer") kanvas.appendChild(tegnMaterialer());
    if (tilstand === "laerer") kanvas.appendChild(tegnPladser());
    opdaterStatuslinje();
  }

  function feltMedLabel(label, under, kontrol) {
    const wrap = el("div", "felt centrum-felt");
    const labelSpan = el("span", "felt-label", label);
    labelSpan.id = `felt-label-${feltId++}`;
    wrap.appendChild(labelSpan);
    if (under) wrap.appendChild(el("span", "under", under));
    const styring = kontrol.matches?.("textarea, select") ? kontrol : kontrol.querySelector?.("textarea, select");
    styring?.setAttribute("aria-labelledby", labelSpan.id);
    wrap.appendChild(kontrol);
    return wrap;
  }

  function tegnCentrum() {
    // Skema-fund A: eksemplarisk centrum var kun forfatterbart i wizarden.
    // Kanvas gør det til det første, forfatteren ser — også over importeret stof.
    f.eksemplarisk_centrum ??= { konkret: "", alment: "" };
    const c = f.eksemplarisk_centrum;
    const wrap = el("div", "centrum-felter");
    wrap.appendChild(feltMedLabel(
      "Det konkrete: hvilket stof, værk eller fænomen står i centrum?",
      "ét nedslag, ikke et pensum — det konkrete valg der bærer forløbet",
      tekstFelt("tekstfelt", c.konkret,
        "fx \"Tove Ditlevsens 'Barndommens gade'\" eller \"gær der hæver dej\"",
        (v) => (c.konkret = v)),
    ));
    wrap.appendChild(feltMedLabel(
      "Det almene: hvilken større indsigt er stoffet et eksempel på?",
      "hvad åbner det konkrete for — det eleverne har med sig, når stoffet er glemt",
      tekstFelt("tekstfelt", c.alment,
        "fx \"hvordan litteratur giver sprog til klasse og opvækst\" eller \"at mikroorganismer omsætter stof\"",
        (v) => (c.alment = v)),
    ));
    return wrap;
  }

  function tegnOmfang() {
    f.omfang ??= { type: "forloeb" };
    const seg = el("div", "segment");
    seg.setAttribute("role", "group");
    const lektionerWrap = el("div");
    const tegnLektioner = () => {
      lektionerWrap.innerHTML = "";
      if (f.omfang.type !== "forloeb") return;
      lektionerWrap.appendChild(inputFelt(null, f.omfang.lektioner, "Antal lektioner (valgfrit)",
        (v) => (f.omfang.lektioner = v || undefined)));
    };
    [["lektion", "Enkelt lektion"], ["forloeb", "Forløb"]].forEach(([v, navn]) => {
      const b = el("button", null, navn);
      b.type = "button";
      b.setAttribute("aria-pressed", String(f.omfang.type === v));
      b.addEventListener("click", () => {
        f.omfang.type = v;
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.textContent === navn)));
        tegnLektioner(); gem();
      });
      seg.appendChild(b);
    });
    tegnLektioner();
    const wrap = el("div");
    wrap.appendChild(seg);
    wrap.appendChild(lektionerWrap);
    return feltMedLabel("Omfang",
      "en enkelt lektion springer dramaturgi-apparatet over — et forløb får det hele", wrap);
  }

  // almind-dev#112 Greb 2: BEGGE-mærke kun på skelet-felter der optræder i
  // begge faner (titel, fag, klassetrin, materialer) — resten siger fanevalget allerede.
  function beggeMaerket(kontrol) {
    const wrap = el("div", "begge-felt");
    wrap.appendChild(el("span", "begge-maerke", "BEGGE"));
    wrap.appendChild(kontrol);
    return wrap;
  }

  function tegnGrundinfo() {
    const kort = el("section", "blok-kort grundinfo");
    if (tilstand === "laerer") kort.appendChild(tegnCentrum());
    kort.appendChild(beggeMaerket(inputFelt("grund-titel", f.titel, "Forløbets titel", (v) => (f.titel = v))));

    const raekke = el("div", "grund-raekke");

    const fagWrap = el("label", "mini-felt");
    fagWrap.appendChild(el("span", "mini-label", "Fag"));
    const fagSel = document.createElement("select");
    tegnFagOptions(fagSel, fagIndex, f.fag);
    fagSel.addEventListener("change", () => {
      f.fag = fagSel.value;
      f.klassetrin = ""; // det gamle udtryk hører til det gamle fag
      document.getElementById("side").dataset.fag = familieFor(f.fag);
      gem();
      tegnTrinValg();
    });
    fagWrap.appendChild(fagSel);
    raekke.appendChild(fagWrap);

    // Klassetrin: fagets egne klasser (udledt af trinforløb, D2 R1) — ét
    // direkte valg. Tom liste (børnehaveklassen o.l.) → fritekst, jf. arkitektur 6.2.
    const trinWrap = el("label", "mini-felt");
    trinWrap.appendChild(el("span", "mini-label", "Klassetrin"));
    const trinZone = el("span");
    trinWrap.appendChild(trinZone);
    async function tegnTrinValg() {
      const klasser = await klasseValgFor(f.fag);
      trinZone.innerHTML = "";
      if (!klasser.length) {
        const inp = inputFelt(null, f.klassetrin, "fx Børnehaveklassen", (v) => (f.klassetrin = v));
        trinZone.appendChild(inp);
        return;
      }
      const trinSel = document.createElement("select");
      trinSel.appendChild(new Option("Vælg ...", "", false, !f.klassetrin));
      const valg = klasser.includes(f.klassetrin) || !f.klassetrin
        ? klasser : [f.klassetrin, ...klasser];
      valg.forEach((v) => trinSel.appendChild(new Option(v, v, false, v === f.klassetrin)));
      trinSel.addEventListener("change", () => { f.klassetrin = trinSel.value; gem(); });
      trinZone.appendChild(trinSel);
    }
    tegnTrinValg();
    raekke.appendChild(trinWrap);

    kort.appendChild(beggeMaerket(raekke));

    if (tilstand === "laerer") {
      kort.appendChild(tegnOmfang());
      const beskrivelse = tekstFelt("tekstfelt", f.beskrivelse,
        "Kort beskrivelse: hvad gør forløbet, og hvad er det stærkt på?",
        (v) => (f.beskrivelse = v));
      beskrivelse.setAttribute("aria-label", "Kort beskrivelse af forløbet");
      kort.appendChild(beskrivelse);
    } else {
      const elevintro = tekstFelt("tekstfelt", f.elevintro,
        "Elevintro: åbn forløbet for eleverne, i jeres eget sprog",
        (v) => (f.elevintro = v));
      elevintro.setAttribute("aria-label", "Elevintro");
      kort.appendChild(elevintro);
    }
    return kort;
  }

  function tegnFaser() {
    const sek = el("section", "editor-sektion");
    sek.appendChild(el("h2", null, "Faser"));

    const liste = el("div", "fase-liste");
    f.faser.forEach((fase, i) => liste.appendChild(tegnFase(fase, i)));
    sek.appendChild(liste);

    // Struktur (rækkefølge, tilføj/slet fase) redigeres kun i lærertilstand —
    // elevtilstand deler skelettet og redigerer kun elevfelterne pr. fase.
    if (tilstand === "laerer") {
      sek.appendChild(tilfoejKnap("+ Ny fase", () => {
        f.faser.push({ titel: "", beskrivelse: "", aktiviteter: [], callouts: [] });
        gem(); tegnKanvas();
      }));
      sek.appendChild(tilfoejKnap("+ Indsæt greb", () => aabnGrebKatalog(null)));

      new Sortable(liste, {
        ...DRAG, handle: ".fase-hoved .haandtag",
        onEnd: (evt) => {
          const [flyttet] = f.faser.splice(evt.oldIndex, 1);
          f.faser.splice(evt.newIndex, 0, flyttet);
          gem(); tegnKanvas();
        },
      });
    }
    return sek;
  }

  function tegnFase(fase, i) {
    fase.aktiviteter ??= []; fase.callouts ??= [];
    fase.elevmaal ??= []; fase.elevaktiviteter ??= []; fase.elevbokse ??= [];
    const kort = el("section", "blok-kort fase-kort");
    kort.dataset.i = i;

    const hoved = el("header", "fase-hoved");
    if (tilstand === "laerer") hoved.appendChild(haandtag());
    hoved.appendChild(el("span", "fase-nr", `Fase ${i + 1}`));
    hoved.appendChild(inputFelt("fase-titel", fase.titel, "Fasens titel", (v) => (fase.titel = v)));
    // Beslutning fase-lektion-tidsestimat (almind-dev#117/#118): varighed
    // blandede tid og afvikling i én streng — splittet i minutter (tal) og
    // afvikling (fritekst: "Dag 1", "Uge 1", "Løbende gennem hele forløbet").
    const tidWrap = el("span", "fase-tid-wrap");
    const minInput = el("input", "fase-minutter");
    minInput.type = "number"; minInput.min = "0"; minInput.placeholder = "min";
    minInput.value = fase.minutter_min ?? "";
    minInput.addEventListener("input", () => {
      fase.minutter_min = minInput.value === "" ? undefined : Number(minInput.value);
      gem();
    });
    const maxInput = el("input", "fase-minutter");
    maxInput.type = "number"; maxInput.min = "0"; maxInput.placeholder = "maks";
    maxInput.value = fase.minutter_max ?? "";
    maxInput.addEventListener("input", () => {
      fase.minutter_max = maxInput.value === "" ? undefined : Number(maxInput.value);
      gem();
    });
    tidWrap.append(
      el("span", "fase-tid-label", "Min."),
      minInput,
      el("span", "fase-tid-label", "–"),
      maxInput,
      inputFelt("fase-afvikling", fase.afvikling, "Dag 1 · skoven", (v) => (fase.afvikling = v)),
    );
    hoved.appendChild(tidWrap);
    if (tilstand === "laerer") {
      hoved.appendChild(sletKnap("Slet fasen", () => {
        if (!confirm(`Slet fase ${i + 1}${fase.titel ? `: ${fase.titel}` : ""}?`)) return;
        f.faser.splice(i, 1);
        gem(); tegnKanvas();
      }));
    }
    kort.appendChild(hoved);

    if (tilstand === "laerer") {
      kort.appendChild(tekstFelt("tekstfelt", fase.beskrivelse,
        "Hvad sker der i denne fase — og hvorfor?", (v) => (fase.beskrivelse = v)));

      // Aktiviteter: trækbare, også på tværs af faser
      kort.appendChild(el("span", "gruppe-navn", "Aktiviteter"));
      const aktListe = el("ol", "aktivitet-liste");
      fase.aktiviteter.forEach((akt, j) => {
        const blok = el("li", "blok aktivitet-blok");
        blok.appendChild(haandtag());
        const indhold = el("div", "aktivitet-indhold");
        indhold.appendChild(inputFelt("aktivitet-titel-felt", akt.titel, "Titel (valgfrit)", (v) => (akt.titel = v)));
        indhold.appendChild(tekstFelt("aktivitet-beskrivelse-felt", akt.beskrivelse, "Beskriv aktiviteten", (v) => (akt.beskrivelse = v)));
        blok.appendChild(indhold);
        blok.appendChild(sletKnap("Slet aktiviteten", () => {
          fase.aktiviteter.splice(j, 1);
          gem(); tegnKanvas();
        }));
        aktListe.appendChild(blok);
      });
      kort.appendChild(aktListe);
      kort.appendChild(tilfoejKnap("+ Aktivitet", () => {
        fase.aktiviteter.push({ titel: "", beskrivelse: "" });
        gem(); tegnKanvas();
      }));

      new Sortable(aktListe, {
        ...DRAG, group: "aktiviteter", handle: ".haandtag",
        onEnd: (evt) => {
          const fraI = +evt.from.closest(".fase-kort").dataset.i;
          const tilI = +evt.to.closest(".fase-kort").dataset.i;
          const [x] = f.faser[fraI].aktiviteter.splice(evt.oldIndex, 1);
          (f.faser[tilI].aktiviteter ??= []).splice(evt.newIndex, 0, x);
          gem(); tegnKanvas();
        },
      });

      // Callouts: det didaktiske lag — vises i editoren med dokumentets egne farver
      kort.appendChild(el("span", "gruppe-navn", "Callouts"));
      const callListe = el("div", "callout-liste");
      fase.callouts.forEach((c, j) => callListe.appendChild(tegnCallout(fase, c, j)));
      kort.appendChild(callListe);
      kort.appendChild(tilfoejKnap("+ Callout", () => {
        fase.callouts.push({ type: "valg", titel: "", tekst: "" });
        gem(); tegnKanvas();
      }));
      kort.appendChild(tilfoejKnap("+ Greb", () => aabnGrebKatalog(fase)));

      new Sortable(callListe, {
        ...DRAG, group: "callouts", handle: ".haandtag",
        onEnd: (evt) => {
          const fraI = +evt.from.closest(".fase-kort").dataset.i;
          const tilI = +evt.to.closest(".fase-kort").dataset.i;
          const [x] = f.faser[fraI].callouts.splice(evt.oldIndex, 1);
          (f.faser[tilI].callouts ??= []).splice(evt.newIndex, 0, x);
          gem(); tegnKanvas();
        },
      });
    } else {
      kort.appendChild(tegnLaererReference(fase));

      kort.appendChild(el("span", "gruppe-navn", "Elevmål"));
      const maalListe = el("ul", "elevmaal-liste");
      fase.elevmaal.forEach((m, j) => {
        const li = el("li", "blok elevmaal-blok");
        li.appendChild(inputFelt(null, m, "Efter denne fase kan du ...", (v) => (fase.elevmaal[j] = v)));
        li.appendChild(sletKnap("Slet målet", () => { fase.elevmaal.splice(j, 1); gem(); tegnKanvas(); }));
        maalListe.appendChild(li);
      });
      kort.appendChild(maalListe);
      kort.appendChild(tilfoejKnap("+ Mål", () => { fase.elevmaal.push(""); gem(); tegnKanvas(); }));

      kort.appendChild(el("span", "gruppe-navn", "Elevtekst"));
      kort.appendChild(tekstFelt("tekstfelt", fase.elevtekst,
        "Omskriv fasen til eleverne, med dit eget register", (v) => (fase.elevtekst = v)));

      kort.appendChild(el("span", "gruppe-navn", "Det skal du (elevaktiviteter)"));
      const eaListe = el("ol", "aktivitet-liste");
      fase.elevaktiviteter.forEach((akt, j) => {
        const blok = el("li", "blok aktivitet-blok");
        const indhold = el("div", "aktivitet-indhold");
        indhold.appendChild(inputFelt("aktivitet-titel-felt", akt.titel, "Titel (valgfrit)", (v) => (akt.titel = v)));
        indhold.appendChild(tekstFelt("aktivitet-beskrivelse-felt", akt.beskrivelse, "Beskriv aktiviteten for eleven", (v) => (akt.beskrivelse = v)));
        blok.appendChild(indhold);
        blok.appendChild(sletKnap("Slet aktiviteten", () => {
          fase.elevaktiviteter.splice(j, 1);
          gem(); tegnKanvas();
        }));
        eaListe.appendChild(blok);
      });
      kort.appendChild(eaListe);
      kort.appendChild(tilfoejKnap("+ Aktivitet", () => {
        fase.elevaktiviteter.push({ titel: "", beskrivelse: "" });
        gem(); tegnKanvas();
      }));

      kort.appendChild(el("span", "gruppe-navn", "Bokse (tip/opgave/regel)"));
      const boksListe = el("div", "callout-liste");
      fase.elevbokse.forEach((b, j) => boksListe.appendChild(tegnElevboks(fase, b, j)));
      kort.appendChild(boksListe);
      kort.appendChild(tilfoejKnap("+ Boks", () => {
        fase.elevbokse.push({ type: "tip", titel: "", tekst: "" });
        gem(); tegnKanvas();
      }));
    }

    return kort;
  }

  // Lærerens beskrivelse/aktiviteter vist dæmpet og læse-kun i elevtilstand,
  // så oversættelsen kan ske side om side (#50-intentionen bevares).
  function tegnLaererReference(fase) {
    const ref = el("div", "laerer-reference");
    ref.appendChild(el("span", "reference-label", "Lærerens tekst (reference)"));
    if (fase.beskrivelse) ref.appendChild(el("p", null, fase.beskrivelse));
    if (fase.aktiviteter.length) {
      const liste = el("ol");
      fase.aktiviteter.forEach((a) =>
        liste.appendChild(el("li", null, a.titel ? `${a.titel}: ${a.beskrivelse || ""}` : a.beskrivelse || "")));
      ref.appendChild(liste);
    }
    if (!fase.beskrivelse && !fase.aktiviteter.length) {
      ref.appendChild(el("p", "under", "Læreren har endnu ikke skrevet noget her."));
    }
    return ref;
  }

  function tegnCallout(fase, c, j) {
    const blok = el("aside", `blok callout-blok callout callout-${c.type || "valg"}`);

    const hoved = el("div", "callout-hoved");
    hoved.appendChild(haandtag());
    const typeSel = document.createElement("select");
    Object.entries(CALLOUT_TYPER).forEach(([v, navn]) =>
      typeSel.appendChild(new Option(navn, v, false, v === (c.type || "valg"))));
    typeSel.addEventListener("change", () => {
      c.type = typeSel.value;
      blok.className = `blok callout-blok callout callout-${c.type}`;
      gem();
    });
    hoved.appendChild(typeSel);
    hoved.appendChild(inputFelt("callout-titel-felt", c.titel, CALLOUT_TYPER[c.type || "valg"], (v) => (c.titel = v)));
    hoved.appendChild(sletKnap("Slet callouten", () => {
      fase.callouts.splice(j, 1);
      gem(); tegnKanvas();
    }));
    blok.appendChild(hoved);

    blok.appendChild(tekstFelt(null, c.tekst,
      "Callout-teksten: valget, opmærksomheden eller invitationen", (v) => (c.tekst = v)));
    return blok;
  }

  // Elevbokse: samme mekanik som lærerens callouts, egen type-liste (tip/opgave/regel)
  function tegnElevboks(fase, b, j) {
    const blok = el("aside", `blok callout-blok callout callout-${b.type || "tip"}`);

    const hoved = el("div", "callout-hoved");
    const typeSel = document.createElement("select");
    Object.entries(ELEVBOKS_TYPER).forEach(([v, navn]) =>
      typeSel.appendChild(new Option(navn, v, false, v === (b.type || "tip"))));
    typeSel.addEventListener("change", () => {
      b.type = typeSel.value;
      blok.className = `blok callout-blok callout callout-${b.type}`;
      gem();
    });
    hoved.appendChild(typeSel);
    hoved.appendChild(inputFelt("callout-titel-felt", b.titel, ELEVBOKS_TYPER[b.type || "tip"], (v) => (b.titel = v)));
    hoved.appendChild(sletKnap("Slet boksen", () => {
      fase.elevbokse.splice(j, 1);
      gem(); tegnKanvas();
    }));
    blok.appendChild(hoved);

    blok.appendChild(tekstFelt(null, b.tekst,
      "Boksens tekst: tippet, opgaven eller reglen", (v) => (b.tekst = v)));
    return blok;
  }

  function tegnMaterialer() {
    const sek = el("section", "editor-sektion");
    const overskrift = el("div", "sektion-hoved");
    overskrift.appendChild(el("h2", null, "Materialer"));
    overskrift.appendChild(el("span", "begge-maerke", "BEGGE"));
    sek.appendChild(overskrift);
    sek.appendChild(el("p", "under", "Links til mitCFU eller andre kilder. De printes med, så materialet følger dokumentet. \"Vises for elever\" styrer om et materiale når elevfladen."));

    const liste = el("div");
    f.materialer.forEach((m, j) => {
      const raekke = el("div", "materiale-raekke");
      raekke.appendChild(inputFelt(null, m.titel, "Titel", (v) => (m.titel = v)));
      raekke.appendChild(inputFelt(null, m.url, "URL", (v) => (m.url = v)));
      // Gissel-type + didaktisering (schema 6.2) — typerne fra destillatet
      if (gisselTyper.length) {
        const typeSel = document.createElement("select");
        typeSel.appendChild(new Option("Materialetype (Gissel) ...", "", false, !m.materialetype));
        gisselTyper.forEach((t) =>
          typeSel.appendChild(new Option(t.navn, t.id, false, m.materialetype === t.id)));
        typeSel.addEventListener("change", () => { m.materialetype = typeSel.value || null; gem(); });
        raekke.appendChild(typeSel);
      }
      raekke.appendChild(inputFelt(null, m.didaktisering,
        "Didaktisering: hvad har du gjort ved materialet?", (v) => (m.didaktisering = v)));
      // #50: elev-flag styrer om materialet vises på elev.html — default fra,
      // så et link kun deles med elever når forfatteren aktivt vælger det.
      const elevLabel = el("label", "materiale-elev-label");
      const elevCheckbox = document.createElement("input");
      elevCheckbox.type = "checkbox";
      elevCheckbox.checked = !!m.elev;
      elevCheckbox.addEventListener("change", () => { m.elev = elevCheckbox.checked; gem(); });
      elevLabel.appendChild(elevCheckbox);
      elevLabel.appendChild(document.createTextNode("Vises for elever"));
      raekke.appendChild(elevLabel);
      // Legacy-felter (fund C): vises kun når allerede udfyldt — nye materialer får dem ikke tilbudt
      if (m.type) raekke.appendChild(inputFelt(null, m.type, "Type (fx E-bog)", (v) => (m.type = v)));
      if (m.faust) raekke.appendChild(inputFelt(null, m.faust, "Faust-nr.", (v) => (m.faust = v)));
      raekke.appendChild(sletKnap("Fjern materialet", () => {
        f.materialer.splice(j, 1);
        gem(); tegnKanvas();
      }));
      liste.appendChild(raekke);
    });
    sek.appendChild(liste);
    sek.appendChild(tilfoejKnap("+ Materiale", () => {
      f.materialer.push({ titel: "", type: "", faust: "", url: "", materialetype: null, didaktisering: "", elev: false });
      gem(); tegnKanvas();
    }));
    return sek;
  }

  // ---------- greb: forudfyldte blokke, én mekanisme for alle tre niveauer ----------

  // Greb-kataloget skriver aktiviteter som rene strenge (kortfattede navne
  // er nok der) — pakkes ind i skemaet (Issue #22) ved selve indsættelsen.
  function somAktivitet(a) {
    return typeof a === "string" ? { titel: "", beskrivelse: a } : a;
  }

  function indsaetGreb(g, fase) {
    if (g.niveau === "makro") {
      f.faser.push(...structuredClone(g.forudfyldt_indhold));
    } else {
      let maal = fase || f.faser[f.faser.length - 1];
      if (!maal) {
        maal = { titel: "", beskrivelse: "", aktiviteter: [], callouts: [] };
        f.faser.push(maal);
      }
      maal.aktiviteter ??= []; maal.callouts ??= [];
      if (g.niveau === "meso") {
        maal.aktiviteter.push(...g.forudfyldt_indhold.map(somAktivitet));
      } else {
        maal.aktiviteter.push(...g.forudfyldt_indhold.aktiviteter.map(somAktivitet));
        if (g.forudfyldt_indhold.callout) {
          // kilde-mærkatet rider med som metadata — dokument.js ignorerer ukendte felter
          maal.callouts.push({ ...structuredClone(g.forudfyldt_indhold.callout), kilde: g.kilde });
        }
      }
    }
    gem(); tegnKanvas();
  }

  const NIVEAU_TEKST = { makro: "Forløbsskelet", meso: "Rytme", mikro: "Aktivitetsgreb" };

  function aabnGrebKatalog(fase) {
    const dlg = document.createElement("dialog");
    dlg.className = "greb-dialog";
    dlg.appendChild(el("h2", null, "Indsæt greb"));
    dlg.appendChild(el("p", "under",
      "Et greb er forudfyldte blokke. Efter indsættelse er de helt almindelige: redigér, flyt eller slet frit."));
    GREB_KATALOG.forEach((g) => {
      const kort = el("button", "greb-kort");
      kort.type = "button";
      kort.appendChild(el("span", "greb-niveau", NIVEAU_TEKST[g.niveau] || g.niveau));
      kort.appendChild(el("strong", null, g.navn));
      kort.appendChild(el("span", "greb-kilde", g.kilde));
      kort.addEventListener("click", () => { dlg.close(); dlg.remove(); indsaetGreb(g, fase); });
      dlg.appendChild(kort);
    });
    const luk = el("button", "tilfoej", "Luk");
    luk.type = "button";
    luk.addEventListener("click", () => { dlg.close(); dlg.remove(); });
    dlg.appendChild(luk);
    dlg.addEventListener("close", () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal(); // native dialog: Esc, fokus-fælde og ::backdrop følger med
  }

  // ---------- åbne pladser: invitationen er en blok-type, ikke en fejlliste ----------

  function saetDG(dim, status) {
    const gammel = f.tomme_pladser.find((p) => p.dimension === dim);
    f.daekningsgrad[dim] = status;
    f.tomme_pladser = f.tomme_pladser.filter((p) => p.dimension !== dim);
    if (status === "tom") f.tomme_pladser.push(gammel || { dimension: dim, besked: "" });
  }

  function tegnPladser() {
    const sek = el("section", "editor-sektion");
    sek.appendChild(el("h2", null, "Åbne pladser"));
    sek.appendChild(el("p", "under",
      "En åben plads er ikke noget du mangler. Det er noget du giver videre: en invitation til den næste lærer, med din begrundelse."));

    DIMENSIONER.forEach((dim) => {
      const status = f.daekningsgrad[dim] || "fuld";
      const boks = el("div", "dim-vaelger" + (status === "tom" ? " aaben" : ""));
      boks.dataset.dimension = dim;

      const hoved = el("div", "dim-hoved");
      hoved.appendChild(el("span", "dim-navn", DIM_NAVNE[dim]));
      const seg = el("span", "segment");
      [["fuld", "Udfyldt"], ["delvis", "Delvist"], ["tom", "Åben plads"]].forEach(([v, navn]) => {
        const b = el("button", null, navn);
        b.type = "button";
        b.setAttribute("aria-pressed", String(status === v));
        b.addEventListener("click", () => { saetDG(dim, v); gem(); tegnKanvas(); });
        seg.appendChild(b);
      });
      hoved.appendChild(seg);
      boks.appendChild(hoved);

      if (status === "tom") {
        let plads = f.tomme_pladser.find((p) => p.dimension === dim);
        if (!plads) { plads = { dimension: dim, besked: "" }; f.tomme_pladser.push(plads); }
        const besked = tekstFelt(null, plads.besked,
          "Hvorfor lader du denne plads stå åben? Din begrundelse vises til den næste lærer.",
          (v) => (plads.besked = v));
        besked.setAttribute("aria-label", `Begrundelse for åben plads: ${DIM_NAVNE[dim]}`);
        boks.appendChild(besked);
      }
      if (fokusDimension === dim) boks.style.borderColor = "var(--accent)";
      sek.appendChild(boks);
    });
    return sek;
  }

  // ---------- profil-panelet: destillaternes spørgsmål, uden tunnel ----------

  function profilFelt(def, kildeTekst) {
    const wrap = el("div", "felt");
    const labelSpan = el("span", "felt-label", def.label);
    labelSpan.id = `profil-label-${feltId++}`;
    if (kildeTekst) labelSpan.appendChild(kildeIkon(kildeTekst));
    wrap.appendChild(labelSpan);
    if (def.under) wrap.appendChild(el("span", "under", def.under));

    let kontrol;
    if (def.type === "chips") {
      kontrol = el("div", "chips");
      kontrol.setAttribute("role", "group");
      const valgte = new Set(def.multi ? f.tags[def.id] || [] : [f.tags[def.id]].filter(Boolean));
      def.valg.forEach((v) => {
        const b = el("button", "chip", v);
        b.type = "button";
        b.setAttribute("aria-pressed", String(valgte.has(v)));
        b.addEventListener("click", () => {
          if (def.multi) {
            valgte.has(v) ? valgte.delete(v) : valgte.add(v);
            f.tags[def.id] = [...valgte];
          } else {
            valgte.clear(); valgte.add(v);
            f.tags[def.id] = v;
          }
          kontrol.querySelectorAll(".chip").forEach((x) =>
            x.setAttribute("aria-pressed", String(valgte.has(x.textContent))));
          gem();
        });
        kontrol.appendChild(b);
      });
    } else if (def.type === "segment") {
      kontrol = el("div", "segment");
      kontrol.setAttribute("role", "group");
      def.valg.forEach((v) => {
        const b = el("button", null, v);
        b.type = "button";
        b.setAttribute("aria-pressed", String(f.tags[def.id] === v));
        b.addEventListener("click", () => {
          f.tags[def.id] = v;
          kontrol.querySelectorAll("button").forEach((x) =>
            x.setAttribute("aria-pressed", String(x.textContent === v)));
          gem();
        });
        kontrol.appendChild(b);
      });
    } else if (def.type === "select") {
      kontrol = document.createElement("select");
      kontrol.appendChild(new Option("Vælg ...", "", false, !f.tags[def.id]));
      def.valg.forEach((v) =>
        kontrol.appendChild(new Option(v, v, false, f.tags[def.id] === v)));
      kontrol.addEventListener("change", () => {
        if (kontrol.value) f.tags[def.id] = kontrol.value;
        gem();
      });
    } else {
      // fritekst → refleksion (vises som valg-callout i dokumentet)
      const kilde = REFLEKSION_KILDER[def.id] || def.label;
      const eksisterende = f.refleksioner.find((r) => r.kilde === kilde);
      kontrol = tekstFelt(null, eksisterende?.tekst, "", (v) => {
        f.refleksioner = f.refleksioner.filter((r) => r.kilde !== kilde);
        if (v.trim()) f.refleksioner.push({ kilde, tekst: v.trim() });
      });
    }
    kontrol.setAttribute("aria-labelledby", labelSpan.id);
    wrap.appendChild(kontrol);
    return wrap;
  }

  // Fund A: fravalg/position og fagplan-kobling kunne kun forfattes i wizarden.
  // Panelet er "opslagsværk"-fladen for samme felter (arkitektur 1.1) —
  // genbruger wizardens rækker/chips-mønstre, ikke wizardens interne state.

  function tegnValgOgFravalg() {
    const grp = document.createElement("details");
    grp.open = true;
    grp.appendChild(el("summary", null, "Valg og fravalg"));
    grp.appendChild(el("p", "under",
      "Et fravalg er ikke en mangel — det er mod til fordybelse. Den næste lærer kan forke forløbet og træffe det modsatte valg."));

    const liste = el("div", "raekke-liste");
    const tegnRaekker = () => {
      liste.innerHTML = "";
      f.fravalg.forEach((fv, i) => {
        const raekke = el("div", "raekke");
        const hvad = inputFelt(null, fv.hvad, "Hvad er valgt fra? fx \"forfatterens øvrige værker\"", (v) => (fv.hvad = v));
        hvad.setAttribute("aria-label", "Hvad er valgt fra");
        raekke.appendChild(hvad);
        const hvorfor = tekstFelt(null, fv.hvorfor, "Hvorfor? Begrundelsen vises til den næste lærer.", (v) => (fv.hvorfor = v));
        hvorfor.setAttribute("aria-label", "Hvorfor er det valgt fra");
        raekke.appendChild(hvorfor);
        const slet = sletKnap("Fjern fravalget", () => { f.fravalg.splice(i, 1); gem(); tegnRaekker(); });
        slet.className = "raekke-slet";
        raekke.appendChild(slet);
        liste.appendChild(raekke);
      });
    };
    tegnRaekker();
    grp.appendChild(liste);
    grp.appendChild(tilfoejKnap("+ Fravalg", () => { f.fravalg.push({ hvad: "", hvorfor: "" }); gem(); tegnRaekker(); }));

    f.didaktisk_position ??= { fagsyn: "", laeringssyn: "" };
    const dp = f.didaktisk_position;
    grp.appendChild(feltMedLabel("Dit fagsyn (valgfrit)",
      "hvad er faget til for, som dette forløb ser det?",
      tekstFelt(null, dp.fagsyn, "", (v) => (dp.fagsyn = v))));
    grp.appendChild(feltMedLabel("Dit læringssyn (valgfrit)",
      "hvordan lærer elever noget, som dette forløb ser det?",
      tekstFelt(null, dp.laeringssyn, "", (v) => (dp.laeringssyn = v))));

    return grp;
  }

  async function tegnKobling() {
    const grp = document.createElement("details");
    grp.open = true;
    grp.appendChild(el("summary", null, "Kobling"));
    grp.appendChild(el("p", "under",
      "Alt her er valgfrit. Kobler du forløbet til fagplanen, optræder det på fagets dækningskort."));

    let fagFil = null;
    try { fagFil = await hentFag(f.fag); } catch { /* ukendt fag-id: sektionen udelades */ }
    if (fagFil?.indholdsomraader?.length) {
      f.fagplan_ref ??= { version: fagFil.fagplan_version, indholdsomraader: [], maal: [] };
      const omraader = new Set(f.fagplan_ref.indholdsomraader);
      const c = el("div", "chips");
      c.setAttribute("role", "group");
      fagFil.indholdsomraader.forEach((omr) => {
        const b = el("button", "chip", omr.navn);
        b.type = "button";
        if (omr.sigte) b.title = omr.sigte;
        b.setAttribute("aria-pressed", String(omraader.has(omr.id)));
        b.addEventListener("click", () => {
          omraader.has(omr.id) ? omraader.delete(omr.id) : omraader.add(omr.id);
          b.setAttribute("aria-pressed", String(omraader.has(omr.id)));
          f.fagplan_ref.indholdsomraader = [...omraader];
          f.fagplan_ref.version = fagFil.fagplan_version;
          gem();
        });
        c.appendChild(b);
      });
      grp.appendChild(feltMedLabel(
        `Hvilke indholdsområder i ${fagFil.navn} åbner forløbet?`,
        `fagplan ${fagFil.fagplan_version} — koblingen pinnes til denne version`, c));
    }

    const samSel = document.createElement("select");
    samSel.appendChild(new Option("Nej — forløbet står alene", "", false, !f.samspil?.form));
    SAMSPIL_FORMER.forEach((form) =>
      samSel.appendChild(new Option(`${form.navn} — ${form.under}`, form.id, false, f.samspil?.form === form.id)));
    const samFagZone = el("div");
    const tegnSamFag = () => {
      samFagZone.innerHTML = "";
      if (!f.samspil?.form) return;
      const c = el("div", "chips");
      c.setAttribute("role", "group");
      c.style.marginTop = "0.6rem";
      const valgte = new Set(f.samspil.fag || []);
      fagIndex.filter((fag) => fag.id !== f.fag).forEach((fag) => {
        const b = el("button", "chip", fag.navn);
        b.type = "button";
        b.setAttribute("aria-pressed", String(valgte.has(fag.id)));
        b.addEventListener("click", () => {
          valgte.has(fag.id) ? valgte.delete(fag.id) : valgte.add(fag.id);
          b.setAttribute("aria-pressed", String(valgte.has(fag.id)));
          f.samspil.fag = [...valgte];
          gem();
        });
        c.appendChild(b);
      });
      samFagZone.appendChild(c);
    };
    samSel.addEventListener("change", () => {
      f.samspil = samSel.value ? { form: samSel.value, fag: f.samspil?.fag || [] } : null;
      tegnSamFag(); gem();
    });
    tegnSamFag();
    const samWrap = el("div");
    samWrap.appendChild(samSel);
    samWrap.appendChild(samFagZone);
    grp.appendChild(feltMedLabel("Indgår forløbet i fagligt samspil?",
      "Bilag 1's tre former — vælg kun hvis forløbet reelt arbejder sammen med andre fag", samWrap));

    return grp;
  }

  // E-G2: begrebs-autocomplete — tilbyder registrets ~100 greb/begreber som
  // forslag, afkræver aldrig. Ukendt input tilføjes alligevel (bliver et
  // "ungt begreb" i grafen, se graf-data.js) — feltet er invitation, ikke gate.
  async function tegnBegreber() {
    const grp = document.createElement("details");
    grp.open = true;
    grp.appendChild(el("summary", null, "Begreber og greb"));
    grp.appendChild(el("p", "under",
      "Hvilke faglige begreber og didaktiske greb bærer forløbet? Bruges til søgning og til at finde beslægtede forløb i konstellationen — helt valgfrit."));

    f.tema ??= [];
    const register = await hentBegreber();
    const opslag = new Map();
    register.forEach((post) => [post.id, post.navn, ...(post.aliaser || [])]
      .forEach((s) => opslag.set(begrebMatchNoegle(s), post)));

    const listeId = "begreber-datalist";
    if (!document.getElementById(listeId)) {
      const dl = el("datalist");
      dl.id = listeId;
      register.forEach((post) => dl.appendChild(new Option(post.navn)));
      document.body.appendChild(dl);
    }

    const chipZone = el("div", "chips");
    chipZone.setAttribute("role", "group");
    const tegnChips = () => {
      chipZone.innerHTML = "";
      f.tema.forEach((t, i) => {
        const kendt = opslag.has(begrebMatchNoegle(t));
        const chip = el("span", "chip begreb-chip" + (kendt ? "" : " ungt"), t + (kendt ? "" : " (nyt)"));
        const slet = sletKnap(`Fjern "${t}"`, () => { f.tema.splice(i, 1); gem(); tegnChips(); });
        chip.appendChild(slet);
        chipZone.appendChild(chip);
      });
    };
    tegnChips();

    const input = el("input");
    input.type = "text";
    input.placeholder = "Skriv et begreb eller greb ...";
    input.setAttribute("list", listeId);
    const tilfoej = () => {
      const v = input.value.trim();
      if (!v) return;
      const findes = f.tema.some((t) => begrebMatchNoegle(t) === begrebMatchNoegle(v));
      if (!findes) { f.tema.push(v); gem(); tegnChips(); }
      input.value = "";
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); tilfoej(); } });
    const tilfoejBtn = tilfoejKnap("+ Tilføj", tilfoej);

    const raekke = el("div", "raekke");
    raekke.appendChild(input);
    raekke.appendChild(tilfoejBtn);

    grp.appendChild(chipZone);
    grp.appendChild(raekke);
    return grp;
  }

  // almind-dev#112 Greb 3: elevmateriale som synlig plads, ikke score —
  // ingen prikker, ingen procent, samme stiplede-kant-konvention som en åben plads.
  // Egen node (ikke hele tegnPanel) genskabes ved kanvas-redraw — tegnPanel henter
  // async destillat-data og skal ikke re-køre for hver fase-strukturændring.
  let statuslinjeEl = null;
  function tegnElevStatuslinje() {
    const antal = f.faser.filter(harElevIndholdFase).length;
    const total = f.faser.length;
    const linje = el("div", "elevmateriale-status" + (antal === 0 ? " tom" : ""));
    const ordFase = total === 1 ? "fase" : "faser";
    linje.appendChild(el("span", null, `Elevmateriale: ${antal} af ${total} ${ordFase} har elevindhold`));
    const seKnap = el("button", "elevmateriale-se-knap", "Se som elev");
    seKnap.type = "button";
    seKnap.addEventListener("click", () => { gemKladde(f); location.href = "elev.html?kladde=1"; });
    linje.appendChild(seKnap);
    return linje;
  }
  function opdaterStatuslinje() {
    if (!statuslinjeEl) return;
    const ny = tegnElevStatuslinje();
    statuslinjeEl.replaceWith(ny);
    statuslinjeEl = ny;
  }

  async function tegnPanel() {
    panel.innerHTML = "";
    statuslinjeEl = tegnElevStatuslinje();
    panel.appendChild(statuslinjeEl);
    panel.appendChild(el("h2", null, "Didaktisk profil"));
    panel.appendChild(el("p", "under",
      "Spørgsmålene kommer fra Alminds teoretiske destillater. Svar når det passer dig — de gør forløbet søgbart og nemt at overtage."));

    const manifest = await hentManifest().catch(() => null);

    for (const t of PROFIL_GRUPPER) {
      const grp = document.createElement("details");
      grp.open = true;
      grp.appendChild(el("summary", null, t.navn));
      for (const kilde of t.sources) {
        let kildeTekst = "";
        const post = manifest?.destillater.find((d) => d.id === kilde.destillat);
        if (post) {
          const dest = await hentDestillat(post);
          kildeTekst = dest.kilde || dest.meta?.kilde || post.titel;
        }
        kilde.felter.forEach((def) => grp.appendChild(profilFelt(def, kildeTekst)));
      }
      panel.appendChild(grp);
    }

    panel.appendChild(tegnValgOgFravalg());
    panel.appendChild(await tegnBegreber());
    panel.appendChild(await tegnKobling());
  }

  // ---------- start ----------

  tegnKanvas();
  tegnPanel();
  gemKladde(f); // kladden findes fra første øjeblik, også før første tastetryk

  if (fokusDimension) {
    kanvas.querySelector(`[data-dimension="${fokusDimension}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
