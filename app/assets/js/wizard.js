// Wizard-motor: det guidede forfatterflow (arkitektur 8.2's 5-trins rygrad,
// omlagt jf. plans/wizard-fase-arkitektur-beslutning.md 2026-07-23).
// A Kernen · B Forløbet · C Fagplan og materialer · D Valg og fravalg · E Dækning.
// Trin hedder bogstaver, ikke tal — faserne EJER tallene (de er sekvensen).
// Princip: maskinlæsbare svar. Chips, segmenter og dropdowns producerer tags
// og schema_version 2-felter; fritekst er undtagelsen, ikke reglen.
// Flowet skriver et forløbs-skelet som kladde og ender i blok-editoren
// (rediger.html) — ikke en tunnel, men en guidet vej ind i samme kanvas.

import {
  hentManifest, hentDestillat, hentFagIndex, hentFag, gemKladde,
  gisselMaterialetyper, SAMSPIL_FORMER, DIMENSIONER, DIM_NAVNE, familieFor,
  tegnFagOptions, treklangKendetegn, treklangLinje,
} from "./data.js";

// Kildehenvisningen var før en synlig tekstlinje under hvert felt — med op
// til 26 felter i uddyb-panelet (og profil-panelet, samme data — se note
// nedenfor) blev det for meget tekst. Nu et (i)-ikon med hover/fokus-tooltip
// (aria-describedby, så skærmlæsere får kilden uanset hover-tilstand).
// Modul-niveau (ikke inde i startWizard) fordi blokke.js's profil-panel
// genbruger den på samme PROFIL_GRUPPER-data.
// kildeTekst er RAW citation (ikke "Kilde: "-præfikset — det tilføjes her som
// egen linje). Citationerne er fulde af initialer ("J.J.", "T.I.", "S.T."),
// så et linjeskift efter hvert punktum ville flække navne — det eneste
// pålidelige brudpunkt er lige efter årstals-parentesen, "(2012).", som
// altid afslutter forfatterlisten.
let _kildeTaeller = 0;
export function kildeIkon(kildeTekst) {
  const id = `kilde-boble-${++_kildeTaeller}`;
  const info = document.createElement("span");
  info.className = "kilde-info";
  info.tabIndex = 0;
  info.setAttribute("aria-describedby", id);
  info.setAttribute("aria-label", "Kilde");
  info.textContent = "i";
  const boble = document.createElement("span");
  boble.className = "kilde-boble";
  boble.id = id;
  boble.setAttribute("role", "tooltip");
  const label = document.createElement("strong");
  label.className = "kilde-boble-label";
  label.textContent = "Kilde";
  boble.appendChild(label);
  const [, forfatterAar, resten] = kildeTekst.match(/^(.*?\(\d{4}\)\.?)\s*(.*)$/s) || [, kildeTekst, ""];
  boble.appendChild(document.createElement("span")).textContent = forfatterAar;
  if (resten) boble.appendChild(document.createElement("span")).textContent = resten;
  info.appendChild(boble);
  // Boblen er center-ankret under ikonet by default (CSS) — men et ikon nær
  // viewportkanten skubber den ud over kanten. Måler og forskyder kun når
  // det faktisk overlapper, i stedet for at vælge left/right-ankring fast
  // (som blot flytter problemet til den anden kant).
  const klemFast = () => {
    boble.style.setProperty("--kilde-shift", "0px");
    const rect = boble.getBoundingClientRect();
    const margin = 12;
    let shift = 0;
    if (rect.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - rect.right;
    else if (rect.left < margin) shift = margin - rect.left;
    if (shift) boble.style.setProperty("--kilde-shift", `${shift}px`);
  };
  info.addEventListener("mouseenter", klemFast);
  info.addEventListener("focus", klemFast);
  return info;
}

// Enum-batteriet: destillaternes strukturerede spørgsmål. Alt her er VALGFRIT
// (arkitektur 8.3). Beslutning 2026-07-23: det monolitiske uddyb-panel er
// opløst — hver gruppe har et trin-anker og renderes sammenfoldet i SIT trin
// (kun ved omfang "forloeb"); i blok-editoren stadig som profil-panel. Én
// kilde, to flader. Dramaturgi-gruppen er væk: alle dens felter er per-fase
// nu (FASE_PROFIL nedenfor).
export const PROFIL_GRUPPER = [
  {
    navn: "Didaktisk fundament",
    trin: "D",
    sources: [
      {
        destillat: "hansen-graf-2012-redidaktisering",
        felter: [
          { id: "strategi", type: "segment", label: "Hvilken planlægningsstrategi inviterer dette forløb læreren til?", under: "læremiddelstyrende, læremiddelstøttende eller åbent?", valg: ["Styret", "Støttet", "Åbent"] },
          { id: "stemme", type: "segment", label: "Hvordan taler lærervejledningen til læreren?", under: "instruktion der følges, eller idékatalog der inspirerer?", valg: ["Instruktion", "Idékatalog", "Blandet"] },
        ],
      },
      {
        destillat: "gissel-2026-materialetyper",
        felter: [
          { id: "materialetyper", type: "chips", multi: true, label: "Hvilke materialetyper indgår i forløbet?", under: "vælg alle der indgår", valg: ["Didaktisk læremiddel", "Semantisk læringsressource", "Redskabslæremiddel"] },
          { id: "didaktiseres_selv", type: "tekst", label: "Hvad skal den næste lærer selv didaktisere?", under: "læringsressourcerne er den stærkeste fork-invitation: dem kan enhver erstatte med lokale alternativer (valgfrit)", valgfri: true },
        ],
      },
    ],
  },
  {
    navn: "Evaluering",
    trin: "E",
    sources: [{
      destillat: "bundsgaard-hansen-2013-kvaliteter-digitale-laeremidler",
      felter: [
        { id: "legitimitet", type: "segment", label: "Legitimitet: er indholdet forankret i gældende læreplaner?", under: "portvagtparameter 1", valg: ["Ja", "Delvist", "Nej"] },
        { id: "variation", type: "segment", label: "Understøtter aktiviteterne variation?", under: "portvagtparameter 3: mikro-, meso- og makroniveau", valg: ["Ja", "Delvist", "Nej"] },
        { id: "evalueringsform", type: "select", label: "Hvilken evalueringsform bruger forløbet?", under: "vælg den primære, eller markér evaluering som åben plads ovenfor", valg: ["Ingen (åben plads)", "Exitspørgsmål", "Portfolio", "Peer feedback", "Fremlæggelse", "Test/quiz", "Samtale"] },
      ],
    }],
  },
];

// Per-fase dramaturgi (beslutning 2026-07-23, almind-dev#129): Brodersens
// felter bor på FASEN, ikke forløbet — vekselvirkningen sker mellem faser og
// kan kun ses der. Værdier gemmes som viste strenge (samme konvention som
// tags). anslag-felterne er BETINGEDE: vises kun når dramaturgisk_funktion
// indeholder "Anslag". Konsumeres af blokke.js's fase-kort og wizard-trin B.
export const FASE_PROFIL = {
  destillat: "brodersen-2021-didaktisk-dramaturgi",
  felter: [
    { id: "dramaturgisk_funktion", type: "chips", multi: true, label: "Fasens dramaturgiske funktion", under: "de fem faser i didaktisk dramaturgi — én fase kan bære flere", valg: ["Anslag", "Mål", "Design", "Krop", "Afslutning"] },
    { id: "virksomhedsformer", type: "chips", multi: true, label: "Hvilke virksomhedsformer er aktive i fasen?", under: "vekselvirkningen mellem faserne er motoren for erfaringsdannelse", valg: ["Æstetisk", "Analytisk", "Håndværksmæssig", "Kommunikativ"] },
    { id: "dewey", type: "chips", multi: true, label: "Hvilke erfaringskvaliteter bærer fasen?", under: "Deweys fem: hvad driver fordybelsen her?", valg: ["Kontinuitet", "Ophobning", "Spænding", "Anticipation", "Fastholdelse"] },
  ],
  anslag: [
    { id: "anslag_type", type: "select", label: "Hvad er anslaget?", under: "begivenheden der skaber øjeblikkelig opmærksomhed og aktiverer forforståelsen", valg: ["Begivenhed", "Varsel", "Orientering", "Projekt"] },
    { id: "anslag_tekst", type: "tekst", label: "Beskriv anslaget med én sætning", under: "den vises på forløbets side (valgfrit)", valgfri: true },
  ],
};

// Rygradens fem trin (rækkefølge besluttet 2026-07-23: konkret→refleksiv-
// gradient, fagplan frem som C — teacher-first). felter-strengen vælger
// renderfunktion i startWizard; blok-editoren bruger PROFIL_GRUPPER/FASE_PROFIL.
const TRIN = [
  { bogstav: "A", navn: "Kernen", felter: "kerne" },
  { bogstav: "B", navn: "Forløbet", felter: "forloeb" },
  { bogstav: "C", navn: "Fagplan og materialer (valgfrit)", felter: "kobling" },
  { bogstav: "D", navn: "Valg og fravalg", felter: "fravalg" },
  { bogstav: "E", navn: "Dækning", felter: "pladser" },
];

// Taksonomi-shape D2 (R1): forfatteren vælger ÉN klasse direkte — fagplanens
// trinforløb udledes, gemmes ikke. Trinforløbenes udtryk er uensartede
// tekst ("7.-9. klassetrin", "7.-8. eller 8.-9. klassetrin", "Børnehaveklassen-
// 3. klasse") — parseren tager pragmatisk min/max af alle tal i udtrykkene
// frem for at forsøge fuld grammatik. Fag uden numeriske trinforløb (ren
// børnehaveklasse-tekst) giver tom liste → fritekst, som i dag.
export async function klasseValgFor(fagId) {
  try {
    const fag = await hentFag(fagId);
    const trinforloeb = fag.trinforloeb || [];
    const tal = trinforloeb.flatMap((t) => [...t.udtryk.matchAll(/(\d+)\./g)].map((m) => Number(m[1])));
    // #68: "Børnehaveklassen" i udtrykket (§11, intet numerisk trinforløb-tal
    // for den) tæller som klassetrin 0 — ellers falder 0. klasse ud af intervallet.
    if (trinforloeb.some((t) => /børnehaveklassen/i.test(t.udtryk))) tal.push(0);
    if (!tal.length) return [];
    const min = Math.min(...tal), max = Math.max(...tal);
    const valg = [];
    for (let k = min; k <= max; k++) valg.push(`${k}. klasse`);
    if (max === 9) valg.push("10. klasse"); // arkitektur D2: udskoling rækker til 10.
    return valg;
  } catch {
    return []; // ukendt fag-id (gamle kladder): fald tilbage til fritekst
  }
}

// original/startDimension er fjernet (fund C — døde parametre, ingen kalder
// dem; fork-med-dimension ejes af editor-vejen rediger.html?fork=&dimension=).
// prefill (arkitektur 2.1 + taksonomi-shape D3): { fag?, omraade? } — aldrig
// en lås, ugyldige værdier droppes stumt. omraade uden gyldigt fag droppes altid.
export async function startWizard({ rod, prefill = {} }) {
  const state = {
    trin: 0,
    kerne: {
      titel: "", fag: "dansk", klassetrin: "", beskrivelse: "",
      konkret: "", alment: "", omfangType: "forloeb", lektioner: "",
    },
    faser: [{ titel: "", beskrivelse: "", aktiviteter: [], callouts: [] }],
    anslag: { type: "", tekst: "" }, // trin B's åbningsspørgsmål — skrives på FØRSTE fase i afslut()
    tags: {},
    fritekst: {},
    pladser: {},
    prefillOmraadeNavn: null, // sat efter validering nedenfor, driver chippen i trin A
    fravalg: [],
    position: { fagsyn: "", laeringssyn: "" },
    kobling: {
      omraader: new Set(), materialer: [], samspilForm: "", samspilFag: new Set(),
    },
    treklang: { kendetegn: new Set(), hvordan: "" }, // W4/#58: legitimerings-gaven, trin C
  };

  DIMENSIONER.forEach((dim) => { state.pladser[dim] = { status: "fuld", besked: "" }; });

  const fagIndex = await hentFagIndex();

  if (prefill.fag && fagIndex.some((f) => f.id === prefill.fag)) {
    state.kerne.fag = prefill.fag;
  }
  if (prefill.omraade && state.kerne.fag) {
    const fagFil = await hentFag(state.kerne.fag).catch(() => null);
    const omr = fagFil?.indholdsomraader?.find((o) => o.id === prefill.omraade);
    if (omr) {
      state.kobling.omraader.add(omr.id);
      state.prefillOmraadeNavn = omr.navn;
    }
  }

  const manifest = await hentManifest();
  const kilder = {};
  const kildeIder = PROFIL_GRUPPER.flatMap((g) => g.sources.map((s) => s.destillat))
    .concat([FASE_PROFIL.destillat, "kap8-indhold-eksemplarisk", "gissel-2026-typologi-laeremidler", "bilag1-centrale-begreber-2026"]);
  for (const did of kildeIder) {
    const post = manifest.destillater.find((d) => d.id === did);
    if (post) kilder[did] = post;
  }
  async function kildeTekstFor(did) {
    const post = kilder[did];
    if (!post) return "";
    const dest = await hentDestillat(post);
    return dest.kilde || dest.meta?.kilde || post.titel;
  }

  async function visTrin() {
    const t = TRIN[state.trin];
    rod.innerHTML = "";
    rod.dataset.fag = familieFor(state.kerne.fag);

    const prog = document.createElement("div");
    prog.className = "wizard-progression";
    prog.setAttribute("role", "progressbar");
    prog.setAttribute("aria-valuenow", state.trin + 1);
    prog.setAttribute("aria-valuemax", TRIN.length);
    TRIN.forEach((_, i) => {
      const s = document.createElement("span");
      s.className = "trin" + (i <= state.trin ? " naaet" : "");
      prog.appendChild(s);
    });
    rod.appendChild(prog);

    const navn = document.createElement("div");
    navn.className = "wizard-trin-navn";
    // Bogstav, ikke tal — og hverken "Trin" eller "af E": progress-baren
    // ovenfor bærer både sekvensen og positionen (aria forbliver numerisk).
    navn.textContent = `${t.bogstav}: ${t.navn}`;
    rod.appendChild(navn);

    if (t.felter === "kerne") await visKerne();
    else if (t.felter === "forloeb") await visForloeb();
    else if (t.felter === "fravalg") await visFravalg();
    else if (t.felter === "pladser") await visPladser();
    else await visKobling();

    visNav();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ---------- feltfabrik ----------

  function feltRamme(def, kildeTekst) {
    const wrap = document.createElement("div");
    wrap.className = "felt";
    const label = document.createElement("span");
    label.className = "felt-label";
    label.textContent = def.label;
    if (kildeTekst) label.appendChild(kildeIkon(kildeTekst));
    wrap.appendChild(label);
    if (def.under) {
      const u = document.createElement("span");
      u.className = "under";
      u.textContent = def.under;
      wrap.appendChild(u);
    }
    return wrap;
  }

  function byggeChips(def) {
    const c = document.createElement("div");
    c.className = "chips";
    c.setAttribute("role", "group");
    const valgte = new Set(def.multi ? state.tags[def.id] || [] : [state.tags[def.id]].filter(Boolean));
    def.valg.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = v;
      b.setAttribute("aria-pressed", String(valgte.has(v)));
      b.addEventListener("click", () => {
        if (def.multi) {
          valgte.has(v) ? valgte.delete(v) : valgte.add(v);
          state.tags[def.id] = [...valgte];
        } else {
          valgte.clear(); valgte.add(v);
          state.tags[def.id] = v;
        }
        c.querySelectorAll(".chip").forEach((x) =>
          x.setAttribute("aria-pressed", String(valgte.has(x.textContent))));
      });
      c.appendChild(b);
    });
    return c;
  }

  function byggeSegment(def) {
    const s = document.createElement("div");
    s.className = "segment";
    s.setAttribute("role", "group");
    def.valg.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = v;
      b.setAttribute("aria-pressed", String(state.tags[def.id] === v));
      b.addEventListener("click", () => {
        state.tags[def.id] = v;
        s.querySelectorAll("button").forEach((x) =>
          x.setAttribute("aria-pressed", String(x.textContent === v)));
      });
      s.appendChild(b);
    });
    return s;
  }

  function byggeSelect(def) {
    const sel = document.createElement("select");
    const tomt = document.createElement("option");
    tomt.value = ""; tomt.textContent = "Vælg ...";
    sel.appendChild(tomt);
    def.valg.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      if (state.tags[def.id] === v) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => { if (sel.value) state.tags[def.id] = sel.value; });
    return sel;
  }

  function byggeTekst(def) {
    const ta = document.createElement("textarea");
    ta.value = state.fritekst[def.id] || "";
    ta.addEventListener("input", () => (state.fritekst[def.id] = ta.value));
    return ta;
  }

  function tekstFelt(def, vaerdi, onInput, kildeTekst) {
    const wrap = feltRamme(def, kildeTekst);
    const ta = document.createElement("textarea");
    ta.value = vaerdi || "";
    if (def.placeholder) ta.placeholder = def.placeholder;
    ta.addEventListener("input", () => onInput(ta.value));
    wrap.appendChild(ta);
    return wrap;
  }

  function tilfoejKnap(tekst, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tilfoej";
    b.textContent = tekst;
    b.addEventListener("click", onClick);
    return b;
  }

  // ---------- trin A: Kernen ----------
  // Taksonomi-shape D3 (R1): rækkefølgen er stilladsering — fag/klassetrin/
  // titel er lette, faktuelle svar der giver momentum FØR det dybe
  // Klafki-spørgsmål. §2-princippet (kun centrum er obligatorisk) berører
  // ikke skærmrækkefølgen, kun gaten i visNav.

  async function visKerne() {
    const g = state.kerne;

    if (state.prefillOmraadeNavn) {
      const chip = document.createElement("p");
      chip.className = "under prefill-chip";
      chip.textContent = `Bygger ind i: ${state.prefillOmraadeNavn} · kan ændres i trin C`;
      rod.appendChild(chip);
    }

    const fagFelt = feltRamme({ label: "Fag" });
    const fagSel = document.createElement("select");
    tegnFagOptions(fagSel, fagIndex, g.fag);
    fagFelt.appendChild(fagSel);
    rod.appendChild(fagFelt);

    // Klassetrin: fagets egne klasser (udledt af trinforløb, D2 R1) — ét
    // direkte valg, intet trinforløb-spørgsmål. Tom liste (børnehaveklassen
    // o.l.) → fritekst, jf. arkitektur 6.2.
    const trinFelt = feltRamme({ label: "Klassetrin" });
    const trinZone = document.createElement("div");
    trinFelt.appendChild(trinZone);
    rod.appendChild(trinFelt);

    async function tegnTrinValg() {
      const klasser = await klasseValgFor(g.fag);
      trinZone.innerHTML = "";
      if (!klasser.length) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = g.klassetrin;
        inp.placeholder = "fx Børnehaveklassen — faget har intet trinforløb";
        inp.addEventListener("input", () => (g.klassetrin = inp.value));
        trinZone.appendChild(inp);
        return;
      }
      const sel = document.createElement("select");
      const tomt = document.createElement("option");
      tomt.value = ""; tomt.textContent = "Vælg ...";
      sel.appendChild(tomt);
      const alle = klasser.includes(g.klassetrin) || !g.klassetrin ? klasser : [g.klassetrin, ...klasser];
      alle.forEach((v) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = v;
        if (v === g.klassetrin) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => (g.klassetrin = sel.value));
      trinZone.appendChild(sel);
    }
    fagSel.addEventListener("change", () => {
      g.fag = fagSel.value;
      g.klassetrin = ""; // den gamle klasse hører til det gamle fag
      rod.dataset.fag = familieFor(g.fag);
      tegnTrinValg();
    });
    await tegnTrinValg();

    const titelFelt = feltRamme({ label: "Forløbets titel" });
    const titelInput = document.createElement("input");
    titelInput.type = "text";
    titelInput.value = g.titel;
    titelInput.addEventListener("input", () => (g.titel = titelInput.value));
    titelFelt.appendChild(titelInput);
    rod.appendChild(titelFelt);

    const klafkiKilde = await kildeTekstFor("kap8-indhold-eksemplarisk");

    rod.appendChild(tekstFelt({
      label: "Det konkrete: hvilket stof, værk eller fænomen står i centrum?",
      under: "ét nedslag, ikke et pensum — det konkrete valg der bærer forløbet",
      placeholder: "fx \"Tove Ditlevsens 'Barndommens gade'\" eller \"gær der hæver dej\"",
    }, g.konkret, (v) => (g.konkret = v), klafkiKilde));

    rod.appendChild(tekstFelt({
      label: "Det almene: hvilken større indsigt er stoffet et eksempel på?",
      under: "hvad åbner det konkrete for — det eleverne har med sig, når stoffet er glemt",
      placeholder: "fx \"hvordan litteratur giver sprog til klasse og opvækst\" eller \"at mikroorganismer omsætter stof\"",
    }, g.alment, (v) => (g.alment = v)));

    const omfangFelt = feltRamme({
      label: "Omfang",
      under: "en enkelt lektion springer dramaturgi-apparatet over — et forløb får det hele",
    });
    const seg = document.createElement("div");
    seg.className = "segment";
    seg.setAttribute("role", "group");
    const lektionerWrap = document.createElement("div");
    const tegnLektioner = () => {
      lektionerWrap.innerHTML = "";
      if (g.omfangType !== "forloeb") return;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "1";
      inp.value = g.lektioner;
      inp.placeholder = "Antal lektioner (valgfrit)";
      inp.style.marginTop = "0.6rem";
      inp.addEventListener("input", () => (g.lektioner = inp.value));
      lektionerWrap.appendChild(inp);
    };
    [["lektion", "Enkelt lektion"], ["forloeb", "Forløb"]].forEach(([v, navn]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = navn;
      b.setAttribute("aria-pressed", String(g.omfangType === v));
      b.addEventListener("click", () => {
        g.omfangType = v;
        seg.querySelectorAll("button").forEach((x) =>
          x.setAttribute("aria-pressed", String(x.textContent === navn)));
        tegnLektioner();
      });
      seg.appendChild(b);
    });
    omfangFelt.appendChild(seg);
    omfangFelt.appendChild(lektionerWrap);
    tegnLektioner();
    rod.appendChild(omfangFelt);

    rod.appendChild(tekstFelt({
      label: "Kort beskrivelse",
      under: "to-tre sætninger: hvad gør forløbet, og hvad er det stærkt på?",
    }, g.beskrivelse, (v) => (g.beskrivelse = v)));
  }

  // ---------- delt uddyb-bygger: én PROFIL_GRUPPER-gruppe som sammenfoldet
  // details i SIT trin (beslutning 2026-07-23 — panelet er opløst kontekstuelt).
  // Kun ved omfang "forloeb": en enkelt lektion bærer ikke apparatet (8.2-8.3).

  async function uddybGruppe(trinBogstav) {
    if (state.kerne.omfangType !== "forloeb") return null;
    const gruppe = PROFIL_GRUPPER.find((g) => g.trin === trinBogstav);
    if (!gruppe) return null;
    const uddyb = document.createElement("details");
    uddyb.className = "uddyb";
    const summary = document.createElement("summary");
    summary.textContent = `${gruppe.navn} (valgfrit)`;
    uddyb.appendChild(summary);
    for (const kilde of gruppe.sources) {
      const kildeTekst = await kildeTekstFor(kilde.destillat);
      kilde.felter.forEach((def) => {
        const wrap = feltRamme(def, kildeTekst);
        let kontrol;
        if (def.type === "chips") kontrol = byggeChips(def);
        else if (def.type === "segment") kontrol = byggeSegment(def);
        else if (def.type === "select") kontrol = byggeSelect(def);
        else kontrol = byggeTekst(def);
        wrap.appendChild(kontrol);
        uddyb.appendChild(wrap);
      });
    }
    return uddyb;
  }

  // ---------- trin B: Forløbet ----------

  async function visForloeb() {
    const erForloeb = state.kerne.omfangType === "forloeb";

    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = erForloeb
      ? "Skitsér forløbets faser — titel og en sætning om hver er nok. Aktiviteter, callouts og detaljer bygger du bagefter i editoren."
      : "Skitsér lektionens indhold som én eller få faser. Detaljerne bygger du bagefter i editoren.";
    rod.appendChild(intro);
    const elevNote = document.createElement("p");
    elevNote.className = "under";
    elevNote.textContent = "Elevmaterialet skriver du bagefter i editoren — under fanen Elevmateriale.";
    rod.appendChild(elevNote);

    // Anslaget FØR fase-skitsen (beslutning 2026-07-23, #130 hypotese b):
    // "hvordan åbner forløbet?" må gerne forme skitsen. Svaret gemmes på
    // FØRSTE fase i afslut() — anslag er en fases funktion, ikke forløbets tag.
    if (erForloeb) {
      const brodersenKilde = await kildeTekstFor(FASE_PROFIL.destillat);
      const [typeDef, tekstDef] = FASE_PROFIL.anslag;

      const typeFelt = feltRamme({
        label: "Hvordan åbner forløbet?",
        under: typeDef.under + " · gemmes på første fase, kan flyttes i editoren",
      }, brodersenKilde);
      const typeSel = document.createElement("select");
      const tomt = document.createElement("option");
      tomt.value = ""; tomt.textContent = "Vælg ...";
      typeSel.appendChild(tomt);
      typeDef.valg.forEach((v) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = v;
        if (state.anslag.type === v) o.selected = true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener("change", () => (state.anslag.type = typeSel.value));
      typeFelt.appendChild(typeSel);
      rod.appendChild(typeFelt);

      rod.appendChild(tekstFelt({
        label: tekstDef.label,
        under: tekstDef.under,
      }, state.anslag.tekst, (v) => (state.anslag.tekst = v)));
    }

    const liste = document.createElement("div");
    liste.className = "raekke-liste";
    const tegnFaser = () => {
      liste.innerHTML = "";
      state.faser.forEach((fase, i) => {
        const kort = document.createElement("div");
        kort.className = "raekke";
        const titel = document.createElement("input");
        titel.type = "text";
        titel.value = fase.titel || "";
        titel.placeholder = `Fase ${i + 1}: titel`;
        titel.addEventListener("input", () => (fase.titel = titel.value));
        kort.appendChild(titel);
        const besk = document.createElement("textarea");
        besk.value = fase.beskrivelse || "";
        besk.placeholder = "Hvad sker der i denne fase — og hvorfor?";
        besk.addEventListener("input", () => (fase.beskrivelse = besk.value));
        kort.appendChild(besk);
        const slet = document.createElement("button");
        slet.type = "button";
        slet.className = "raekke-slet";
        slet.textContent = "×";
        slet.title = "Slet fasen";
        slet.setAttribute("aria-label", "Slet fasen");
        slet.addEventListener("click", () => { state.faser.splice(i, 1); tegnFaser(); });
        kort.appendChild(slet);
        liste.appendChild(kort);
      });
    };
    tegnFaser();
    rod.appendChild(liste);
    rod.appendChild(tilfoejKnap("+ Fase", () => {
      state.faser.push({ titel: "", beskrivelse: "", aktiviteter: [], callouts: [] });
      tegnFaser();
    }));
  }

  // ---------- trin D: Valg og fravalg ----------
  // Inviteret, ikke tvunget (arkitektur 2 + 6.2): fravalget er en didaktisk
  // handling (Wagenschein), positionen er valgfri men aktivt inviteret.

  async function visFravalg() {
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = "Et fravalg er ikke en mangel — det er mod til fordybelse. Hvad har du bevidst valgt fra, og hvorfor? Den næste lærer kan forke forløbet og træffe det modsatte valg.";
    rod.appendChild(intro);

    const liste = document.createElement("div");
    liste.className = "raekke-liste";
    const tegnRaekker = () => {
      liste.innerHTML = "";
      state.fravalg.forEach((fv, i) => {
        const kort = document.createElement("div");
        kort.className = "raekke";
        const hvad = document.createElement("input");
        hvad.type = "text";
        hvad.value = fv.hvad || "";
        hvad.placeholder = "Hvad er valgt fra? fx \"forfatterens øvrige værker\"";
        hvad.addEventListener("input", () => (fv.hvad = hvad.value));
        kort.appendChild(hvad);
        const hvorfor = document.createElement("textarea");
        hvorfor.value = fv.hvorfor || "";
        hvorfor.placeholder = "Hvorfor? Begrundelsen vises til den næste lærer.";
        hvorfor.addEventListener("input", () => (fv.hvorfor = hvorfor.value));
        kort.appendChild(hvorfor);
        const slet = document.createElement("button");
        slet.type = "button";
        slet.className = "raekke-slet";
        slet.textContent = "×";
        slet.title = "Fjern fravalget";
        slet.setAttribute("aria-label", "Fjern fravalget");
        slet.addEventListener("click", () => { state.fravalg.splice(i, 1); tegnRaekker(); });
        kort.appendChild(slet);
        liste.appendChild(kort);
      });
    };
    tegnRaekker();
    rod.appendChild(liste);
    rod.appendChild(tilfoejKnap("+ Fravalg", () => {
      state.fravalg.push({ hvad: "", hvorfor: "" });
      tegnRaekker();
    }));

    rod.appendChild(tekstFelt({
      label: "Dit fagsyn (valgfrit)",
      under: "hvad er faget til for, som dette forløb ser det? Én-to sætninger gør forløbet nemmere at vurdere — og uenighed nemmere at forke",
    }, state.position.fagsyn, (v) => (state.position.fagsyn = v)));

    rod.appendChild(tekstFelt({
      label: "Dit læringssyn (valgfrit)",
      under: "hvordan lærer elever noget, som dette forløb ser det?",
    }, state.position.laeringssyn, (v) => (state.position.laeringssyn = v)));

    // Fundament-gruppen hører hjemme her: den handler, som fagsyn/læringssyn,
    // om forfatterens stemme og hvad næste lærer overtager.
    const uddyb = await uddybGruppe("D");
    if (uddyb) rod.appendChild(uddyb);
  }

  // ---------- trin E: Dækning ----------

  async function visPladser() {
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = "En åben plads er ikke noget du mangler. Det er noget du giver videre: en invitation til den næste lærer, med din begrundelse.";
    rod.appendChild(intro);

    DIMENSIONER.forEach((dim) => {
      const p = state.pladser[dim];
      const boks = document.createElement("div");
      boks.className = "dim-vaelger" + (p.status === "tom" ? " aaben" : "");
      const seg = [["fuld", "Udfyldt"], ["delvis", "Delvist"], ["tom", "Åben plads"]]
        .map(([v, navn]) => `<button type="button" data-v="${v}" aria-pressed="${p.status === v}">${navn}</button>`)
        .join("");
      boks.innerHTML = `
        <div class="dim-hoved">
          <span class="dim-navn">${DIM_NAVNE[dim]}</span>
          <span class="segment">${seg}</span>
        </div>
      `;
      const omraade = document.createElement("div");
      const tegn = () => {
        omraade.innerHTML = "";
        if (p.status === "tom") {
          const ta = document.createElement("textarea");
          ta.placeholder = "Hvorfor lader du denne plads stå åben? Din begrundelse vises til den næste lærer.";
          ta.value = p.besked;
          ta.addEventListener("input", () => (p.besked = ta.value));
          omraade.appendChild(ta);
        }
        boks.classList.toggle("aaben", p.status === "tom");
        boks.querySelectorAll(".segment button").forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.v === p.status)));
      };
      boks.querySelectorAll(".segment button").forEach((b) =>
        b.addEventListener("click", () => { p.status = b.dataset.v; tegn(); }));
      tegn();
      boks.appendChild(omraade);
      rod.appendChild(boks);
    });

    // Evaluerings-gruppen bor her (beslutning 2026-07-23): evaluering er én
    // af dimensionerne ovenfor — spørgsmålene hører til samme gennemgang.
    const uddyb = await uddybGruppe("E");
    if (uddyb) rod.appendChild(uddyb);
  }

  // ---------- trin C: Fagplan og materialer (valgfrit) ----------
  // Frivillig legitimering (arkitektur 3), flyttet frem fra sidstepladsen
  // (beslutning 2026-07-23): fagplan-forankring er lærerens spørgsmål, ikke
  // en eftertanke — dækningskort-effekten er konsekvens, ikke motiv.

  async function visKobling() {
    const g = state.kerne;
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = "Hvor i fagplanen hører forløbet hjemme? Alt her er valgfrit — koblingen sætter forløbet på fagets dækningskort og gør det nemmere for andre lærere at finde.";
    rod.appendChild(intro);

    // Fagplan-reference: fagets egne indholdsområder som chips
    let fagFil = null;
    try { fagFil = await hentFag(g.fag); } catch { /* ukendt fag-id: sektionen udelades */ }
    if (fagFil?.indholdsomraader?.length) {
      const felt = feltRamme({
        label: `Hvilke indholdsområder i ${fagFil.navn} åbner forløbet?`,
        under: `fagplan ${fagFil.fagplan_version} — koblingen pinnes til denne version`,
      });
      const c = document.createElement("div");
      c.className = "chips";
      c.setAttribute("role", "group");
      fagFil.indholdsomraader.forEach((omr) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = omr.navn;
        b.title = omr.sigte || "";
        b.setAttribute("aria-pressed", String(state.kobling.omraader.has(omr.id)));
        b.addEventListener("click", () => {
          state.kobling.omraader.has(omr.id)
            ? state.kobling.omraader.delete(omr.id)
            : state.kobling.omraader.add(omr.id);
          b.setAttribute("aria-pressed", String(state.kobling.omraader.has(omr.id)));
        });
        c.appendChild(b);
      });
      felt.appendChild(c);
      rod.appendChild(felt);
    }

    // W4/#58: treklangen som legitimerings-gave — de 10 kendetegn som chips
    // (ALDRIG tre ben-afkrydsninger, ALDRIG score), inviteret hvordan-sætning,
    // live-linje der viser gaven. Vokabular fra destillatet, aldrig hardcodet.
    const kendetegn = await treklangKendetegn();
    const bilagKildeTekst = await kildeTekstFor("bilag1-centrale-begreber-2026");
    if (kendetegn.length) {
      const felt = feltRamme({
        label: "Hvorfor er forløbet vigtigt? Vælg de kendetegn på alsidig undervisning, det bærer",
        under: "Bilag 1's 10 kendetegn kobler forløbet til kundskaber, engagement og myndighed",
      }, bilagKildeTekst);
      const c = document.createElement("div");
      c.className = "chips";
      c.setAttribute("role", "group");
      const linje = document.createElement("p");
      linje.className = "under treklang-linje";
      const opdaterLinje = () => {
        const tekst = treklangLinje([...state.treklang.kendetegn], kendetegn);
        linje.textContent = tekst;
        linje.hidden = !tekst;
      };
      kendetegn.forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = k.navn;
        b.setAttribute("aria-pressed", String(state.treklang.kendetegn.has(k.id)));
        b.addEventListener("click", () => {
          state.treklang.kendetegn.has(k.id)
            ? state.treklang.kendetegn.delete(k.id)
            : state.treklang.kendetegn.add(k.id);
          b.setAttribute("aria-pressed", String(state.treklang.kendetegn.has(k.id)));
          opdaterLinje();
        });
        c.appendChild(b);
      });
      felt.appendChild(c);
      opdaterLinje();
      felt.appendChild(linje);
      rod.appendChild(felt);

      rod.appendChild(tekstFelt({
        label: "Hvordan? (valgfrit)",
        under: "gør legitimeringen til din egen — den indgår i lærervejledningen med dine ord",
      }, state.treklang.hvordan, (v) => (state.treklang.hvordan = v)));
    }

    // Materialer med Gissel-type + didaktiserings-note (arkitektur 6.2).
    // Typerne læses fra typologi-destillatet — aldrig hardcodet.
    const typer = await gisselMaterialetyper();
    const typologiKilde = await kildeTekstFor("gissel-2026-typologi-laeremidler");
    const matFelt = feltRamme({
      label: "Materialer",
      under: "links til mitCFU eller andre kilder — de printes med, så materialet følger dokumentet",
    }, typologiKilde);
    const matListe = document.createElement("div");
    matListe.className = "raekke-liste";
    const tegnMaterialer = () => {
      matListe.innerHTML = "";
      state.kobling.materialer.forEach((m, i) => {
        const kort = document.createElement("div");
        kort.className = "raekke";
        const titel = document.createElement("input");
        titel.type = "text";
        titel.value = m.titel || "";
        titel.placeholder = "Titel";
        titel.addEventListener("input", () => (m.titel = titel.value));
        kort.appendChild(titel);
        const url = document.createElement("input");
        url.type = "text";
        url.value = m.url || "";
        url.placeholder = "URL";
        url.addEventListener("input", () => (m.url = url.value));
        kort.appendChild(url);
        const typeSel = document.createElement("select");
        const tomt = document.createElement("option");
        tomt.value = ""; tomt.textContent = "Materialetype (Gissel) ...";
        typeSel.appendChild(tomt);
        typer.forEach((t) => {
          const o = document.createElement("option");
          o.value = t.id; o.textContent = t.navn;
          if (m.materialetype === t.id) o.selected = true;
          typeSel.appendChild(o);
        });
        typeSel.addEventListener("change", () => (m.materialetype = typeSel.value || null));
        kort.appendChild(typeSel);
        const did = document.createElement("textarea");
        did.value = m.didaktisering || "";
        did.placeholder = "Didaktisering: hvad har du gjort ved materialet? (kun relevant for læringsressourcer)";
        did.addEventListener("input", () => (m.didaktisering = did.value));
        kort.appendChild(did);
        const slet = document.createElement("button");
        slet.type = "button";
        slet.className = "raekke-slet";
        slet.textContent = "×";
        slet.title = "Fjern materialet";
        slet.setAttribute("aria-label", "Fjern materialet");
        slet.addEventListener("click", () => { state.kobling.materialer.splice(i, 1); tegnMaterialer(); });
        kort.appendChild(slet);
        matListe.appendChild(kort);
      });
    };
    tegnMaterialer();
    matFelt.appendChild(matListe);
    const matKnap = tilfoejKnap("+ Materiale", () => {
      state.kobling.materialer.push({ titel: "", url: "", materialetype: null, didaktisering: "" });
      tegnMaterialer();
    });
    matFelt.appendChild(matKnap);
    rod.appendChild(matFelt);

    // Samspil: Bilag 1's tre former
    const bilagKilde = await kildeTekstFor("bilag1-centrale-begreber-2026");
    const samFelt = feltRamme({
      label: "Indgår forløbet i fagligt samspil?",
      under: "Bilag 1's tre former — vælg kun hvis forløbet reelt arbejder sammen med andre fag",
    }, bilagKilde);
    const samSel = document.createElement("select");
    const intet = document.createElement("option");
    intet.value = ""; intet.textContent = "Nej — forløbet står alene";
    samSel.appendChild(intet);
    SAMSPIL_FORMER.forEach((form) => {
      const o = document.createElement("option");
      o.value = form.id; o.textContent = `${form.navn} — ${form.under}`;
      if (state.kobling.samspilForm === form.id) o.selected = true;
      samSel.appendChild(o);
    });
    const samFagZone = document.createElement("div");
    const tegnSamFag = () => {
      samFagZone.innerHTML = "";
      if (!state.kobling.samspilForm) return;
      const c = document.createElement("div");
      c.className = "chips";
      c.setAttribute("role", "group");
      c.style.marginTop = "0.6rem";
      fagIndex.filter((fag) => fag.id !== g.fag).forEach((fag) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = fag.navn;
        b.setAttribute("aria-pressed", String(state.kobling.samspilFag.has(fag.id)));
        b.addEventListener("click", () => {
          state.kobling.samspilFag.has(fag.id)
            ? state.kobling.samspilFag.delete(fag.id)
            : state.kobling.samspilFag.add(fag.id);
          b.setAttribute("aria-pressed", String(state.kobling.samspilFag.has(fag.id)));
        });
        c.appendChild(b);
      });
      samFagZone.appendChild(c);
    };
    samSel.addEventListener("change", () => {
      state.kobling.samspilForm = samSel.value;
      tegnSamFag();
    });
    samFelt.appendChild(samSel);
    samFelt.appendChild(samFagZone);
    tegnSamFag();
    rod.appendChild(samFelt);
  }

  // ---------- navigation ----------

  function visNav() {
    const nav = document.createElement("div");
    nav.className = "wizard-nav";
    const tilbage = document.createElement("button");
    tilbage.className = "knap sekundaer";
    tilbage.textContent = "Tilbage";
    tilbage.disabled = state.trin === 0;
    tilbage.addEventListener("click", () => { state.trin--; visTrin(); });

    const frem = document.createElement("button");
    frem.className = "knap";
    frem.textContent = state.trin === TRIN.length - 1 ? "Åbn i editoren" : "Videre";
    frem.addEventListener("click", () => {
      // Det eksemplariske centrum er skemaets eneste obligatoriske nye felt
      // (arkitektur 6.2) — resten af wizard'en inviterer, dette ene kræver.
      // Parret er udeleligt (fund C): konkret uden alment er en aktivitet,
      // alment uden konkret er en floskel.
      if (state.trin === 0) {
        const felter = rod.querySelectorAll(".felt textarea");
        const manglerKonkret = !state.kerne.konkret.trim();
        const mangler = manglerKonkret ? felter[0] : !state.kerne.alment.trim() ? felter[1] : null;
        if (mangler) {
          mangler.focus();
          mangler.closest(".felt")?.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
      }
      if (state.trin < TRIN.length - 1) { state.trin++; visTrin(); }
      else afslut();
    });

    nav.appendChild(tilbage);
    nav.appendChild(frem);
    rod.appendChild(nav);
  }

  // ---------- afslut: skriv schema_version 2-kladden, land i editoren ----------

  async function afslut() {
    const g = state.kerne;
    const tommePladser = DIMENSIONER
      .filter((d) => state.pladser[d].status === "tom")
      .map((d) => ({ dimension: d, besked: state.pladser[d].besked || "Bevidst åben plads." }));

    const daekningsgrad = {};
    DIMENSIONER.forEach((d) => { daekningsgrad[d] = state.pladser[d].status; });

    const refleksioner = Object.entries(state.fritekst)
      .filter(([, v]) => v && v.trim())
      .map(([, v]) => ({ kilde: "Didaktisering", tekst: v.trim() }));

    const omfang = g.omfangType === "lektion"
      ? { type: "lektion" }
      : { type: "forloeb", ...(g.lektioner ? { lektioner: Number(g.lektioner) } : {}) };

    const fravalg = state.fravalg
      .filter((fv) => (fv.hvad || "").trim())
      .map((fv) => ({ hvad: fv.hvad.trim(), hvorfor: (fv.hvorfor || "").trim() }));

    const didaktisk_position = (state.position.fagsyn.trim() || state.position.laeringssyn.trim())
      ? { fagsyn: state.position.fagsyn.trim(), laeringssyn: state.position.laeringssyn.trim() }
      : null;

    let fagplan_ref = null;
    if (state.kobling.omraader.size) {
      const fagFil = await hentFag(g.fag).catch(() => null);
      fagplan_ref = {
        version: fagFil?.fagplan_version || null,
        indholdsomraader: [...state.kobling.omraader],
        maal: [],
      };
    }

    const samspil = state.kobling.samspilForm
      ? { form: state.kobling.samspilForm, fag: [...state.kobling.samspilFag] }
      : null;

    // W4/#58: tomt felt = intet output nogen steder
    const treklang = (state.treklang.kendetegn.size || state.treklang.hvordan.trim())
      ? { kendetegn: [...state.treklang.kendetegn], hvordan: state.treklang.hvordan.trim() }
      : null;

    const faser = state.faser.filter((f) => (f.titel || "").trim() || (f.beskrivelse || "").trim());

    // Trin B's anslag-svar lander på FØRSTE fase (beslutning 2026-07-23,
    // bevidst simplificering — editoren kan flytte det). Uden faser er der
    // intet at hænge det på; så droppes det.
    if (faser.length && (state.anslag.type || state.anslag.tekst.trim())) {
      const første = faser[0];
      første.dramaturgisk_funktion = [...new Set([...(første.dramaturgisk_funktion || []), "Anslag"])];
      if (state.anslag.type) første.anslag_type = state.anslag.type;
      if (state.anslag.tekst.trim()) første.anslag_tekst = state.anslag.tekst.trim();
    }

    gemKladde({
      id: "kladde",
      schema_version: 3,
      titel: g.titel || "Uden titel",
      undertitel: null,
      forfatter: "Dig",
      institution: "Din skole",
      aar: new Date().getFullYear(),
      fag: g.fag,
      klassetrin: g.klassetrin || "",
      omfang,
      eksemplarisk_centrum: { konkret: g.konkret.trim(), alment: g.alment.trim() },
      fravalg,
      didaktisk_position,
      fagplan_ref,
      samspil,
      treklang,
      licens: "CC BY-SA 4.0",
      opdateret: new Date().toISOString().slice(0, 10),
      fork_af: null,
      beskrivelse: g.beskrivelse || "",
      tags: state.tags,
      daekningsgrad,
      tomme_pladser: tommePladser,
      faser,
      materialer: state.kobling.materialer.filter((m) => (m.titel || "").trim() || (m.url || "").trim()),
      refleksioner,
    });
    location.href = "rediger.html?kladde=1";
  }

  visTrin();
}
