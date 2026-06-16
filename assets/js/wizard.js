// Wizard-motor: deles af upload.html (tom start) og fork.html (forudfyldt).
// Princip: maskinlæsbare svar. Chips, segmenter og dropdowns producerer tags
// der binder forløb sammen og gør dem søgbare. Fritekst er undtagelsen, ikke reglen.
// Valgmulighederne kommer fra destillaternes lag2_kategorier (struktureret her,
// med destillatet som kilde vist under hvert felt).

import { hentManifest, hentDestillat, gemKladde, DIMENSIONER, DIM_NAVNE, familieFor } from "./data.js";

const FAG_VALG = ["dansk", "historie", "religion", "matematik", "fysik", "teknik", "natur/teknik", "geografi", "biologi", "musik", "billedkunst", "drama"];
const KLASSETRIN_VALG = ["0.-3. klasse", "4.-6. klasse", "7.-9. klasse", "10. klasse"];

// Strukturerede felter pr. destillat. id = tag-nøgle i kladden.
const TRIN = [
  { navn: "Grundinfo", felter: "grundinfo" },
  {
    navn: "Didaktisk fundament",
    destillat: "hansen-graf-2012-redidaktisering",
    felter: [
      { id: "strategi", type: "segment", label: "Hvilken planlægningsstrategi inviterer dette forløb læreren til?", under: "styrende, støttende eller åbent?", valg: ["Læremiddelstyret", "Læremiddelstøttet", "Åbent"] },
      { id: "stemme", type: "segment", label: "Hvordan taler lærervejledningen til læreren?", under: "instruktion der følges, eller idékatalog der inspirerer?", valg: ["Instruktion", "Idékatalog", "Blandet"] },
    ],
    destillat2: "gissel-2026-materialetyper",
    felter2: [
      { id: "materialetyper", type: "chips", multi: true, label: "Hvilke materialetyper indgår i forløbet?", under: "vælg alle der indgår", valg: ["Didaktisk læremiddel", "Semantisk læringsressource", "Redskabslæremiddel"] },
      { id: "didaktiseres_selv", type: "tekst", label: "Hvad skal den næste lærer selv didaktisere?", under: "læringsressourcerne er den stærkeste fork-invitation: dem kan enhver erstatte med lokale alternativer (valgfrit)", valgfri: true },
    ],
  },
  {
    navn: "Dramaturgi",
    destillat: "brodersen-2021-didaktisk-dramaturgi",
    felter: [
      { id: "anslag_type", type: "select", label: "Hvad er forløbets anslag?", under: "begivenheden der skaber øjeblikkelig opmærksomhed og aktiverer forforståelsen", valg: ["Begivenhed", "Varsel", "Orientering", "Projekt"] },
      { id: "virksomhedsformer", type: "chips", multi: true, label: "Hvilke virksomhedsformer veksler forløbet imellem?", under: "vekselvirkningen er motoren for erfaringsdannelse", valg: ["Æstetisk", "Analytisk", "Håndværksmæssig", "Kommunikativ"] },
      { id: "dewey", type: "chips", multi: true, label: "Hvilke erfaringskvaliteter bærer forløbet?", under: "Deweys fem: hvad driver fordybelsen?", valg: ["Kontinuitet", "Ophobning", "Spænding", "Anticipation", "Fastholdelse"] },
      { id: "anslag_tekst", type: "tekst", label: "Beskriv anslaget med én sætning", under: "den vises på forløbets side (valgfrit)", valgfri: true },
    ],
  },
  {
    navn: "Evaluering",
    destillat: "bundsgaard-hansen-2013-kvaliteter-digitale-laeremidler",
    felter: [
      { id: "legitimitet", type: "segment", label: "Legitimitet: er indholdet forankret i gældende læreplaner?", under: "portvagtparameter 1", valg: ["Ja", "Delvist", "Nej"] },
      { id: "variation", type: "segment", label: "Understøtter aktiviteterne variation?", under: "portvagtparameter 3: mikro-, meso- og makroniveau", valg: ["Ja", "Delvist", "Nej"] },
      { id: "evalueringsform", type: "select", label: "Hvilken evalueringsform bruger forløbet?", under: "vælg den primære, eller markér evaluering som åben plads i næste trin", valg: ["Ingen (åben plads)", "Exitspørgsmål", "Portfolio", "Peer feedback", "Fremlæggelse", "Test/quiz", "Samtale"] },
    ],
  },
  { navn: "Åbne pladser", felter: "pladser" },
];

export async function startWizard({ rod, original = null, startDimension = null }) {
  const state = {
    trin: 0,
    grundinfo: {
      titel: original ? original.titel : "",
      fag: original ? original.fag : "dansk",
      klassetrin: original ? original.klassetrin : "",
      beskrivelse: original ? original.beskrivelse : "",
    },
    tags: { ...(original?.tags || {}) },   // maskinlæsbare svar; fork arver originalens tags
    fritekst: {},
    pladser: {},
    fokusDimension: startDimension || null,
    original,
  };

  DIMENSIONER.forEach((dim) => {
    const erTom = original ? original.daekningsgrad?.[dim] === "tom" : false;
    const arvetBesked = original?.tomme_pladser?.find((p) => p.dimension === dim)?.besked || "";
    state.pladser[dim] = { aaben: erTom, besked: erTom ? arvetBesked : "" };
  });

  const manifest = await hentManifest();
  const kilder = {};
  for (const t of TRIN) {
    for (const did of [t.destillat, t.destillat2].filter(Boolean)) {
      const post = manifest.destillater.find((d) => d.id === did);
      if (post) kilder[did] = post;
    }
  }

  async function visTrin() {
    const t = TRIN[state.trin];
    rod.innerHTML = "";
    rod.dataset.fag = familieFor(state.grundinfo.fag);

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
    navn.textContent = `Trin ${state.trin + 1} af ${TRIN.length}: ${t.navn}`;
    rod.appendChild(navn);

    if (t.felter === "grundinfo") visGrundinfo();
    else if (t.felter === "pladser") visPladser();
    else await visStruktureredeFelter(t);

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
    wrap.appendChild(label);
    if (def.under) {
      const u = document.createElement("span");
      u.className = "under";
      u.textContent = def.under;
      wrap.appendChild(u);
    }
    if (kildeTekst) {
      const k = document.createElement("p");
      k.className = "destillat-kilde";
      k.textContent = kildeTekst;
      wrap.appendChild(k);
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

  async function visStruktureredeFelter(t) {
    const grupper = [
      { did: t.destillat, felter: t.felter },
      ...(t.destillat2 ? [{ did: t.destillat2, felter: t.felter2 }] : []),
    ];
    for (const gruppe of grupper) {
      const post = kilder[gruppe.did];
      let kildeTekst = "";
      if (post) {
        const dest = await hentDestillat(post);
        kildeTekst = "Kilde: " + (dest.kilde || dest.meta?.kilde || post.titel);
      }
      gruppe.felter.forEach((def) => {
        const wrap = feltRamme(def, kildeTekst);
        let kontrol;
        if (def.type === "chips") kontrol = byggeChips(def);
        else if (def.type === "segment") kontrol = byggeSegment(def);
        else if (def.type === "select") kontrol = byggeSelect(def);
        else kontrol = byggeTekst(def);
        wrap.insertBefore(kontrol, wrap.querySelector(".destillat-kilde"));
        rod.appendChild(wrap);
      });
    }
  }

  function visGrundinfo() {
    const g = state.grundinfo;

    const titelFelt = feltRamme({ label: "Forløbets titel" });
    const titelInput = document.createElement("input");
    titelInput.type = "text";
    titelInput.value = g.titel;
    titelInput.addEventListener("input", () => (g.titel = titelInput.value));
    titelFelt.appendChild(titelInput);
    rod.appendChild(titelFelt);

    const fagFelt = feltRamme({ label: "Fag" });
    const fagSel = document.createElement("select");
    FAG_VALG.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      if (v === g.fag) o.selected = true;
      fagSel.appendChild(o);
    });
    fagSel.addEventListener("change", () => { g.fag = fagSel.value; rod.dataset.fag = familieFor(g.fag); });
    fagFelt.appendChild(fagSel);
    rod.appendChild(fagFelt);

    const trinFelt = feltRamme({ label: "Klassetrin" });
    const trinSel = document.createElement("select");
    KLASSETRIN_VALG.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      if (g.klassetrin.includes(v.split(".")[0])) o.selected = true;
      trinSel.appendChild(o);
    });
    if (g.klassetrin) { const o = document.createElement("option"); o.value = g.klassetrin; o.textContent = g.klassetrin; o.selected = true; trinSel.appendChild(o); }
    trinSel.addEventListener("change", () => (g.klassetrin = trinSel.value));
    trinFelt.appendChild(trinSel);
    rod.appendChild(trinFelt);

    const beskFelt = feltRamme({ label: "Kort beskrivelse", under: "to-tre sætninger: hvad gør forløbet, og hvad er det stærkt på?" });
    const ta = document.createElement("textarea");
    ta.value = g.beskrivelse;
    ta.addEventListener("input", () => (g.beskrivelse = ta.value));
    beskFelt.insertBefore(ta, null);
    rod.appendChild(beskFelt);
  }

  function visPladser() {
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = "En åben plads er ikke noget du mangler. Det er noget du giver videre: en invitation til den næste lærer, med din begrundelse.";
    rod.appendChild(intro);

    DIMENSIONER.forEach((dim) => {
      const p = state.pladser[dim];
      const boks = document.createElement("div");
      boks.className = "dim-vaelger" + (p.aaben ? " aaben" : "");
      boks.innerHTML = `
        <div class="dim-hoved">
          <span class="dim-navn">${DIM_NAVNE[dim]}</span>
          <span class="segment">
            <button type="button" data-v="fuld" aria-pressed="${!p.aaben}">Udfyldt</button>
            <button type="button" data-v="aaben" aria-pressed="${p.aaben}">Åben plads</button>
          </span>
        </div>
      `;
      const omraade = document.createElement("div");
      const tegn = () => {
        omraade.innerHTML = "";
        if (p.aaben) {
          const ta = document.createElement("textarea");
          ta.placeholder = "Hvorfor lader du denne plads stå åben? Din begrundelse vises til den næste lærer.";
          ta.value = p.besked;
          ta.addEventListener("input", () => (p.besked = ta.value));
          omraade.appendChild(ta);
        }
        boks.classList.toggle("aaben", p.aaben);
        boks.querySelectorAll(".segment button").forEach((b) =>
          b.setAttribute("aria-pressed", String((b.dataset.v === "aaben") === p.aaben)));
      };
      boks.querySelectorAll(".segment button").forEach((b) =>
        b.addEventListener("click", () => { p.aaben = b.dataset.v === "aaben"; tegn(); }));
      tegn();
      boks.appendChild(omraade);
      if (state.fokusDimension === dim) boks.style.borderColor = "var(--accent)";
      rod.appendChild(boks);
    });
  }

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
    frem.textContent = state.trin === TRIN.length - 1 ? "Se dit forløb som dokument" : "Videre";
    frem.addEventListener("click", () => {
      if (state.trin < TRIN.length - 1) { state.trin++; visTrin(); }
      else afslut();
    });

    nav.appendChild(tilbage);
    nav.appendChild(frem);
    rod.appendChild(nav);
  }

  function afslut() {
    const g = state.grundinfo;
    const tommePladser = DIMENSIONER
      .filter((d) => state.pladser[d].aaben)
      .map((d) => ({ dimension: d, besked: state.pladser[d].besked || "Bevidst åben plads." }));

    const daekningsgrad = {};
    DIMENSIONER.forEach((d) => {
      daekningsgrad[d] = state.pladser[d].aaben
        ? "tom"
        : original?.daekningsgrad?.[d] && original.daekningsgrad[d] !== "tom"
          ? original.daekningsgrad[d]
          : "fuld";
    });

    const refleksioner = Object.entries(state.fritekst)
      .filter(([, v]) => v && v.trim())
      .map(([id, v]) => ({ kilde: id === "anslag_tekst" ? "Anslag" : "Didaktisering", tekst: v.trim() }));

    gemKladde({
      id: "kladde",
      titel: g.titel || "Uden titel",
      undertitel: original ? "Fork af " + (original.undertitel || original.titel) : null,
      forfatter: "Dig",
      institution: "Din skole",
      aar: new Date().getFullYear(),
      fag: g.fag,
      klassetrin: g.klassetrin || "",
      licens: "CC BY-SA 4.0",
      opdateret: new Date().toISOString().slice(0, 10),
      fork_af: original ? original.id : null,
      beskrivelse: g.beskrivelse || "",
      tags: state.tags,
      daekningsgrad,
      tomme_pladser: tommePladser,
      faser: original ? original.faser : [],
      materialer: original ? original.materialer || [] : [],
      refleksioner,
    });
    location.href = "preview.html?kladde=1";
  }

  visTrin();
}
