// Blok-editor: forløbsobjektet ER editorens tilstand.
// Blokkene er 1:1 med forloeb.json-skemaet (faser, aktiviteter, callouts,
// materialer, åbne pladser) — ingen mapping, intet eget dokumentformat.
// Tekstfelter binder direkte til objektet; kun strukturændringer
// (tilføj/slet/træk) gentegner kanvassen, så fokus aldrig mistes under skrivning.
// Drag-to-reorder: SortableJS (loades som script-tag af rediger.html).

import {
  DIMENSIONER, DIM_NAVNE, familieFor, faseBogstav,
  hentManifest, hentDestillat, gemKladde,
} from "./data.js";
import { TRIN, FAG_VALG, KLASSETRIN_VALG } from "./wizard.js";
import { GREB_KATALOG } from "./greb-katalog.js";

export const CALLOUT_TYPER = {
  valg: "Didaktisk valg",
  obs: "Opmærksomhed",
  almind: "Almind: fork-invitation",
  dramaturgi: "Dramaturgisk arkitektur",
  gissel: "Materialetyper (Gissel)",
};

// Fritekst-svar fra profilen gemmes som refleksioner (samme som wizardens afslut)
const REFLEKSION_KILDER = { anslag_tekst: "Anslag", didaktiseres_selv: "Didaktisering" };

const iDag = () => new Date().toISOString().slice(0, 10);

// forceFallback: SortableJS' egen drag-motor frem for native HTML5-drag —
// ens opførsel på desktop, touch og Safari, og ghost-stilen kan styles
const DRAG = { animation: 150, forceFallback: true, fallbackTolerance: 4 };

export function nytForloeb() {
  return {
    id: "kladde", titel: "", undertitel: null, forfatter: "Dig", institution: "Din skole",
    aar: new Date().getFullYear(), fag: "dansk", klassetrin: "", licens: "CC BY-SA 4.0",
    opdateret: iDag(), fork_af: null, forks: [], beskrivelse: "", tags: {},
    daekningsgrad: Object.fromEntries(DIMENSIONER.map((d) => [d, "fuld"])),
    tomme_pladser: [], faser: [], materialer: [], refleksioner: [],
  };
}

export function forkAf(original) {
  const f = structuredClone(original);
  f.id = "kladde";
  f.fork_af = original.id;
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

export function startEditor({ kanvas, panel, f, fokusDimension = null }) {
  f.faser ??= []; f.tomme_pladser ??= []; f.materialer ??= [];
  f.refleksioner ??= []; f.tags ??= {}; f.daekningsgrad ??= {};

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

  function tegnKanvas() {
    kanvas.innerHTML = "";
    kanvas.appendChild(tegnGrundinfo());
    kanvas.appendChild(tegnFaser());
    kanvas.appendChild(tegnMaterialer());
    kanvas.appendChild(tegnPladser());
  }

  function tegnGrundinfo() {
    const kort = el("section", "blok-kort grundinfo");
    kort.appendChild(inputFelt("grund-titel", f.titel, "Forløbets titel", (v) => (f.titel = v)));

    const raekke = el("div", "grund-raekke");

    const fagWrap = el("label", "mini-felt");
    fagWrap.appendChild(el("span", "mini-label", "Fag"));
    const fagSel = document.createElement("select");
    FAG_VALG.forEach((v) => {
      const o = new Option(v, v, false, v === f.fag);
      fagSel.appendChild(o);
    });
    fagSel.addEventListener("change", () => {
      f.fag = fagSel.value;
      document.getElementById("side").dataset.fag = familieFor(f.fag);
      gem();
    });
    fagWrap.appendChild(fagSel);
    raekke.appendChild(fagWrap);

    const trinWrap = el("label", "mini-felt");
    trinWrap.appendChild(el("span", "mini-label", "Klassetrin"));
    const trinSel = document.createElement("select");
    trinSel.appendChild(new Option("Vælg ...", "", false, !f.klassetrin));
    const valg = KLASSETRIN_VALG.includes(f.klassetrin) || !f.klassetrin
      ? KLASSETRIN_VALG : [f.klassetrin, ...KLASSETRIN_VALG];
    valg.forEach((v) => trinSel.appendChild(new Option(v, v, false, v === f.klassetrin)));
    trinSel.addEventListener("change", () => { f.klassetrin = trinSel.value; gem(); });
    trinWrap.appendChild(trinSel);
    raekke.appendChild(trinWrap);

    kort.appendChild(raekke);
    kort.appendChild(tekstFelt("tekstfelt", f.beskrivelse,
      "Kort beskrivelse: hvad gør forløbet, og hvad er det stærkt på?",
      (v) => (f.beskrivelse = v)));
    return kort;
  }

  function tegnFaser() {
    const sek = el("section", "editor-sektion");
    sek.appendChild(el("h2", null, "Faser"));

    const liste = el("div", "fase-liste");
    f.faser.forEach((fase, i) => liste.appendChild(tegnFase(fase, i)));
    sek.appendChild(liste);

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
    return sek;
  }

  function tegnFase(fase, i) {
    fase.aktiviteter ??= []; fase.callouts ??= [];
    const kort = el("section", "blok-kort fase-kort");
    kort.dataset.i = i;

    const hoved = el("header", "fase-hoved");
    hoved.appendChild(haandtag());
    hoved.appendChild(el("span", "fase-nr", `Fase ${faseBogstav(i)}`));
    hoved.appendChild(inputFelt("fase-titel", fase.titel, "Fasens titel", (v) => (fase.titel = v)));
    hoved.appendChild(sletKnap("Slet fasen", () => {
      if (!confirm(`Slet fase ${i + 1}${fase.titel ? `: ${fase.titel}` : ""}?`)) return;
      f.faser.splice(i, 1);
      gem(); tegnKanvas();
    }));
    kort.appendChild(hoved);

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

    return kort;
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

  function tegnMaterialer() {
    const sek = el("section", "editor-sektion");
    sek.appendChild(el("h2", null, "Materialer"));
    sek.appendChild(el("p", "under", "Links til mitCFU eller andre kilder. De printes med, så materialet følger dokumentet."));

    const liste = el("div");
    f.materialer.forEach((m, j) => {
      const raekke = el("div", "materiale-raekke");
      raekke.appendChild(inputFelt(null, m.titel, "Titel", (v) => (m.titel = v)));
      raekke.appendChild(inputFelt(null, m.type, "Type (fx E-bog)", (v) => (m.type = v)));
      raekke.appendChild(inputFelt(null, m.faust, "Faust-nr.", (v) => (m.faust = v)));
      raekke.appendChild(inputFelt(null, m.url, "URL", (v) => (m.url = v)));
      raekke.appendChild(sletKnap("Fjern materialet", () => {
        f.materialer.splice(j, 1);
        gem(); tegnKanvas();
      }));
      liste.appendChild(raekke);
    });
    sek.appendChild(liste);
    sek.appendChild(tilfoejKnap("+ Materiale", () => {
      f.materialer.push({ titel: "", type: "", faust: "", url: "" });
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
        boks.appendChild(tekstFelt(null, plads.besked,
          "Hvorfor lader du denne plads stå åben? Din begrundelse vises til den næste lærer.",
          (v) => (plads.besked = v)));
      }
      if (fokusDimension === dim) boks.style.borderColor = "var(--accent)";
      sek.appendChild(boks);
    });
    return sek;
  }

  // ---------- profil-panelet: destillaternes spørgsmål, uden tunnel ----------

  function profilFelt(def, kildeTekst) {
    const wrap = el("div", "felt");
    wrap.appendChild(el("span", "felt-label", def.label));
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
    wrap.appendChild(kontrol);
    if (kildeTekst) wrap.appendChild(el("p", "destillat-kilde", kildeTekst));
    return wrap;
  }

  async function tegnPanel() {
    panel.innerHTML = "";
    panel.appendChild(el("h2", null, "Didaktisk profil"));
    panel.appendChild(el("p", "under",
      "Spørgsmålene kommer fra Alminds teoretiske destillater. Svar når det passer dig — de gør forløbet søgbart og nemt at overtage."));

    const manifest = await hentManifest().catch(() => null);

    for (const t of TRIN) {
      if (typeof t.felter === "string") continue; // grundinfo og pladser bor på kanvassen
      const grp = document.createElement("details");
      grp.open = true;
      grp.appendChild(el("summary", null, t.navn));
      const grupper = [
        { did: t.destillat, felter: t.felter },
        ...(t.destillat2 ? [{ did: t.destillat2, felter: t.felter2 }] : []),
      ];
      for (const g of grupper) {
        let kildeTekst = "";
        const post = manifest?.destillater.find((d) => d.id === g.did);
        if (post) {
          const dest = await hentDestillat(post);
          kildeTekst = "Kilde: " + (dest.kilde || dest.meta?.kilde || post.titel);
        }
        g.felter.forEach((def) => grp.appendChild(profilFelt(def, kildeTekst)));
      }
      panel.appendChild(grp);
    }
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
