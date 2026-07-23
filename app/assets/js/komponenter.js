// Delte DOM-komponenter: kort, dækningsgradsprofil, tomme pladser (fold), fagbånd.

import { familieFor, fagNavn, DIMENSIONER, DIM_NAVNE, antalAabnePladser, datoTekst, kaede, gisselDefinition, klassetrinTilInterval } from "./data.js";
import { gemKnap } from "./samling.js";

// "8 lektioner" / "Enkelt lektion" / "Forløb" (uspecificeret længde) —
// browse-planens §3: at filtrere på omfang uden at vise det er en synlig selvmodsigelse.
export function omfangTekst(omfang) {
  if (!omfang) return "";
  if (omfang.type === "lektion") return "Enkelt lektion";
  return omfang.lektioner ? `${omfang.lektioner} lektioner` : "Forløb";
}

// Beslutning fase-lektion-tidsestimat (almind-dev#117), delvist omgjort
// almind-dev#128: fasens tid (minutter) og dens afvikling/kontekst ("i skoven",
// "løbende gennem hele forløbet") er stadig to forskellige ting — men "Dag N"/
// "Uge N" der bare gentager fasens egen placering i rækkefølgen er redundant
// (faserne ER sekvensen; en dobbeltlektion er bare to faser, ikke én fase
// mærket "Dag 1"). De to vises derfor ikke længere sammen i én pille — se
// plans/fase-lektion-tidsestimat-beslutning.md's rettelse 2026-07-22.
export function faseTidTekst(fase) {
  if (fase.minutter_min == null) return "";
  return fase.minutter_min === fase.minutter_max
    ? `ca. ${fase.minutter_min} min`
    : `${fase.minutter_min}–${fase.minutter_max} min`;
}
// Kontekst ud over selve tidsforbruget: hvor foregår fasen, eller hvordan
// afviger dens rytme fra en almindelig lineær fase ("løbende", "midtvejs").
// Aldrig "Dag N"/"Uge N" alene — det er fasenummeret allerede.
export function faseKontekstTekst(fase) {
  return fase.afvikling || "";
}

// Per-fase dramaturgi (beslutning 2026-07-23, almind-dev#136): kompakt linje
// til fase-hovedet — funktion · virksomhedsformer · Dewey, kun det der er sat.
export function faseDramaturgiTekst(fase) {
  return [
    fase.dramaturgisk_funktion?.length ? fase.dramaturgisk_funktion.join("+") : "",
    fase.virksomhedsformer?.length ? fase.virksomhedsformer.join(" · ") : "",
    fase.dewey?.length ? fase.dewey.join(" · ") : "",
  ].filter(Boolean).join("  |  ");
}

// Forløbs-aggregat: union af fase-tags når mindst én fase er tagget; ellers
// legacy-forløbs-tags (fallback — de 14 seeds er endnu ikke migreret, jf.
// forfatter-skøns-reglen). Beregnes altid, gemmes ALDRIG i JSON. anslag_type/
// anslag_tekst kommer fra FØRSTE anslag-fase.
export function dramaturgiUnion(f) {
  const faser = f.faser || [];
  const union = (id) => [...new Set(faser.flatMap((fa) => fa[id] || []))];
  const virksomhedsformer = union("virksomhedsformer");
  const dewey = union("dewey");
  const anslagFase = faser.find((fa) => (fa.dramaturgisk_funktion || []).includes("Anslag")
    || fa.anslag_type || fa.anslag_tekst);
  const harFaseTags = !!(virksomhedsformer.length || dewey.length || anslagFase);
  if (harFaseTags) {
    return {
      virksomhedsformer, dewey,
      anslag_type: anslagFase?.anslag_type || null,
      anslag_tekst: anslagFase?.anslag_tekst || null,
    };
  }
  return {
    virksomhedsformer: f.tags?.virksomhedsformer || [],
    dewey: f.tags?.dewey || [],
    anslag_type: f.tags?.anslag_type || null,
    anslag_tekst: null, // legacy anslag_tekst bor i refleksioner, ikke tags
  };
}

// Forløbstotal: kun beregnet når ALLE faser har minutter (delvis dækning er
// vildledende, jf. beslutningen). Ellers falder den tilbage til forfatterens
// eget omfang.lektioner-skøn, ellers viser den intet — aldrig en advarsel.
export function forloebOmfangTekst(f, lektionslaengde) {
  const faser = f.faser || [];
  const fuldDaekning = faser.length > 0 && faser.every((fa) => fa.minutter_min != null);
  if (fuldDaekning) {
    const sumMin = faser.reduce((s, fa) => s + fa.minutter_min, 0);
    const sumMax = faser.reduce((s, fa) => s + fa.minutter_max, 0);
    if (sumMax < lektionslaengde) {
      return sumMin === sumMax ? `ca. ${sumMin} min` : `${sumMin}–${sumMax} min`;
    }
    const lekMin = Math.floor(sumMin / lektionslaengde);
    const lekMax = Math.ceil(sumMax / lektionslaengde);
    const lekTekst = lekMin === lekMax ? `ca. ${lekMin} lektioner` : `ca. ${lekMin}–${lekMax} lektioner`;
    const timerTekst = (min) => (min / 60).toFixed(1).replace(/\.0$/, "").replace(".", ",");
    const timer = timerTekst(sumMin) === timerTekst(sumMax) ? `${timerTekst(sumMin)} timer` : `${timerTekst(sumMin)}–${timerTekst(sumMax)} timer`;
    return `Estimeret omfang: ${lekTekst} (${timer})`;
  }
  if (f.omfang?.lektioner) return `${f.omfang.lektioner} lektioner (forfatterens skøn)`;
  return "";
}

// Kortet er en <article>, ikke ét stort <a> — fag/klassetrin skal være rigtige,
// selvstændige links (samme facet-mønster som sequence.html, issue #65-familien),
// og nestede <a>-i-<a> er ugyldig HTML (browseren lukker den yderste for tidligt,
// halve kortet mister sit klik). Løsningen er det gængse "stretched link"-greb:
// titlen er kortets rigtige, semantiske link; dens ::after strækkes til at dække
// hele kortet (CSS), og de andre links får z-index for stadig at kunne klikkes.
export function forloebKort(f, alle) {
  const fam = familieFor(f.fag);
  const a = document.createElement("article");
  a.className = "kort";
  a.dataset.fag = fam;

  const k = alle ? kaede(alle, f.id) : [f];
  const pladser = antalAabnePladser(f);
  const omfang = omfangTekst(f.omfang);
  const klassetrinInterval = klassetrinTilInterval(f.klassetrin);

  const tags = document.createElement("div");
  tags.className = "kort-tags";
  const tagFag = document.createElement("a");
  tagFag.className = "tag";
  tagFag.href = `fag.html?id=${f.fag}`;
  tagFag.textContent = fagNavn(f.fag);
  tags.appendChild(tagFag);
  const tagKlasse = document.createElement(klassetrinInterval ? "a" : "span");
  tagKlasse.className = "tag neutral";
  if (klassetrinInterval) tagKlasse.href = `browse.html?klassetrin=${klassetrinInterval[0]}`;
  tagKlasse.textContent = f.klassetrin;
  tags.appendChild(tagKlasse);
  if (f.demo) {
    const tagDemo = document.createElement("span");
    tagDemo.className = "tag neutral";
    tagDemo.textContent = "Eksempel";
    tags.appendChild(tagDemo);
  }

  const h3 = document.createElement("h3");
  const titelLink = document.createElement("a");
  titelLink.className = "kort-titel-link";
  titelLink.href = `sequence.html?id=${f.id}`;
  titelLink.textContent = f.titel;
  h3.appendChild(titelLink);

  const beskrivelse = document.createElement("p");
  beskrivelse.className = "kort-beskrivelse";
  beskrivelse.textContent = f.beskrivelse;

  const meta = document.createElement("div");
  meta.className = "metadata";
  meta.textContent = `${f.forfatter} · ${datoTekst(f.opdateret)}${omfang ? ` · ${omfang}` : ""}`;

  const bund = document.createElement("div");
  bund.className = "kort-bund";
  if (k.length > 1) {
    const mini = document.createElement("span");
    mini.className = "mini-genealogi";
    mini.title = `${k.length} versioner`;
    k.forEach((v, i) => {
      const prik = document.createElement("span");
      prik.className = "prik" + (v.id === f.id ? " fyldt" : "");
      mini.appendChild(prik);
      if (i < k.length - 1) mini.appendChild(Object.assign(document.createElement("span"), { className: "streg" }));
    });
    bund.appendChild(mini);
  } else {
    const enkelt = document.createElement("span");
    enkelt.className = "metadata";
    enkelt.textContent = "1 version";
    bund.appendChild(enkelt);
  }
  if (pladser) {
    const badge = document.createElement("span");
    badge.className = "plads-badge";
    badge.textContent = `${pladser} ${pladser === 1 ? "åben plads" : "åbne pladser"}`;
    bund.appendChild(badge);
  }
  if (f.daekningsgrad) {
    const dgStatus = daekningsgradSamlet(f);
    const dgBadge = document.createElement("span");
    dgBadge.className = "kort-dg";
    dgBadge.innerHTML = `<span class="dg-prikker" role="img" aria-label="Dækningsgrad: ${STATUS_TEKST[dgStatus]}">${dgPrikker(dgStatus)}</span>`;
    bund.appendChild(dgBadge);
  }

  a.append(tags, h3, beskrivelse, meta, bund);
  a.appendChild(gemKnap(f.id));
  return a;
}

// Kortets kompakte dg-badge: ét aggregeret 3-prik-udtryk for hele forløbet
// (fuld hvis alle 6 dimensioner er fulde, tom hvis alle er tomme, ellers delvis).
export function daekningsgradSamlet(f) {
  const statusser = DIMENSIONER.map((dim) => f.daekningsgrad?.[dim] || "tom");
  if (statusser.every((s) => s === "fuld")) return "fuld";
  if (statusser.every((s) => s === "tom")) return "tom";
  return "delvis";
}

// Prikker: nøjagtig samme visuelle kode som print-dokumentets dg-prik (Typst-systemet).
export function dgPrikker(status) {
  if (status === "fuld") return `<span class="p-fuld">&#9679;&#9679;&#9679;</span>`;
  if (status === "delvis") return `<span class="p-delvis">&#9679;&#9679;</span><span class="p-tom">&#9675;</span>`;
  return `<span class="p-delvis">&#9679;</span><span class="p-tom">&#9675;&#9675;</span>`;
}

const STATUS_TEKST = { fuld: "fuldt dækket", delvis: "delvist", tom: "åben plads" };

export function dgProfil(f) {
  const wrap = document.createElement("div");
  wrap.className = "dg-profil";
  DIMENSIONER.forEach((dim) => {
    const status = f.daekningsgrad?.[dim] || "tom";
    const raekke = document.createElement("div");
    raekke.className = "dg-raekke";
    raekke.dataset.status = status;
    raekke.innerHTML = `
      <span class="dg-navn">${DIM_NAVNE[dim]}</span>
      <span class="dg-prikker" role="img" aria-label="${DIM_NAVNE[dim]}: ${STATUS_TEKST[status]}">${dgPrikker(status)}</span>
      <span class="dg-status-tekst">${STATUS_TEKST[status]}</span>
    `;
    wrap.appendChild(raekke);
  });
  return wrap;
}

// Tom plads: stiplet kant der folder sig ud (native details).
export function pladsFold(f, plads) {
  const d = document.createElement("details");
  d.className = "plads";

  const summary = document.createElement("summary");
  const pil = document.createElement("span");
  pil.className = "fold-pil";
  pil.textContent = "▶";
  const label = document.createElement("span");
  label.className = "plads-label";
  label.textContent = `Åben plads: ${DIM_NAVNE[plads.dimension] || plads.dimension}`;
  const preview = document.createElement("span");
  preview.className = "plads-preview";
  preview.textContent = plads.besked;
  summary.append(pil, label, preview);

  const krop = document.createElement("div");
  krop.className = "plads-krop";
  const bq = document.createElement("blockquote");
  bq.appendChild(document.createTextNode(plads.besked));
  bq.appendChild(document.createElement("br"));
  const forfatterSpan = document.createElement("span");
  forfatterSpan.className = "metadata";
  forfatterSpan.textContent = f.forfatter;
  bq.appendChild(forfatterSpan);
  const gisselDef = document.createElement("p");
  gisselDef.className = "gissel-def";
  gisselDef.dataset.dim = plads.dimension;
  const forkLink = document.createElement("a");
  forkLink.className = "knap fag";
  forkLink.href = `rediger.html?fork=${f.id}&dimension=${plads.dimension}`;
  forkLink.textContent = "Fork herfra";
  krop.append(bq, gisselDef, forkLink);

  d.append(summary, krop);
  // Gissel-definition hentes lazy ved første åbning.
  d.addEventListener("toggle", async () => {
    const felt = d.querySelector(".gissel-def");
    if (d.open && !felt.textContent) {
      const def = await gisselDefinition(plads.dimension);
      if (def) felt.innerHTML = `<strong>Gissel (2024):</strong> ${def}`;
    }
  }, { once: false });
  return d;
}

// Forsidens fag-oversigt: 2 rækker × 3 kolonner, hver kolonne en vertikal
// liste (Valdemar, 2026-07-16 — erstatter en tidligere kort-grid-udgave, som
// gav uens kortbredde mellem grupper og fik lange fagnavne til at knække
// grimt midt i ordet). Redaktionel inddeling til forsiden alene — ikke
// fagfamilie-feltet (arkitektur 7.2: familie er kun farve). Praktiske og
// Kreative er slået sammen til "Praktiske & æstetiske fag" (samme navnevalg
// som FAMILIE_NAVN.aes i data.js, kun med "&" for konsekvens med sidens andre
// fagnavne) — giver desuden en pæn 5/5/3-symmetri i begge rækker.
const FAG_RAEKKER = [
  [
    { navn: "Sprogfag", fag: ["dansk", "engelsk", "tysk", "fransk", "modersmaalsundervisning"] },
    { navn: "Naturfag", fag: ["matematik", "fysik-kemi", "natur-teknologi", "geografi", "biologi"] },
    { navn: "Kulturfag", fag: ["historie", "samfundsfag", "religionskundskab"] },
  ],
  [
    // Praktiske & æstetiske fag / Valgfag deler rækkefølge for de fire fag,
    // der findes i begge udgaver (musik, billedkunst, håndværk & design,
    // madkundskab) — en lærer der underviser i den obligatoriske udgave,
    // underviser ofte også i valgfagsudgaven, så samme række = samme fag.
    // idræt og teknologiforståelse har ingen modpart i den anden kolonne og
    // deler bevidst den øverste, umatchede række (Valdemar, 2026-07-16).
    { navn: "Praktiske & æstetiske fag", fag: ["idraet", "musik", "billedkunst", "haandvaerk-og-design", "madkundskab"] },
    {
      navn: "Valgfag",
      fag: ["teknologiforstaaelse-valgfag", "musik-valgfag", "billedkunst-valgfag", "haandvaerk-og-design-valgfag", "madkundskab-valgfag"],
      valgfag: true,
    },
    { navn: "Øvrige / særlige fag", fag: ["dsa-basis", "dsa-supplerende", "boernehaveklassen"] },
  ],
];

// "(valgfag)"-suffikset er nødvendigt i fag-index.json (adskiller fra den
// obligatoriske udgave i flade lister som wizard/browse-facetten), men
// redundant her, hvor kolonnens egen overskrift "Valgfag" allerede siger det.
// Kun et visningstrick — selve navn-feltet i data røres ikke.
function stripValgfagSuffiks(navn) {
  return navn.replace(/\s*\(valgfag\)$/, "");
}

function fagFeltKort(fag, alle, kolonne) {
  const antal = alle.filter((f) => f.fag === fag.id).length;
  const a = document.createElement("a");
  a.className = "fag-felt";
  a.dataset.fag = familieFor(fag.id);
  a.href = `fag.html?id=${fag.id}`;
  const visningsnavn = kolonne.valgfag ? stripValgfagSuffiks(fag.navn) : fag.navn;
  a.innerHTML = `
    <span class="navn">${visningsnavn}</span>
    <span class="antal${antal ? "" : " tom"}">${antal ? `${antal} forløb` : "Vær den første"}</span>
  `;
  return a;
}

// Kolonnebredden matcher .kortgrid (samme minmax(290px,1fr)-logik som
// forløbskortene i S6) — fagkort og forløbskort skal læses som samme
// slags objekt. Skriftstørrelsen på .fag-felt .navn er tunet i CSS til
// præcis at holde "modersmålsundervisning" på én linje ved kolonnens
// smalleste bredde (290px); alle andre fagnavne bruger samme størrelse.
export function fagGrid(fagIndex, alle) {
  const oversigt = document.createElement("div");
  oversigt.className = "fag-oversigt";
  FAG_RAEKKER.forEach((raekke) => {
    const raekkeEl = document.createElement("div");
    raekkeEl.className = "fag-raekke";
    raekke.forEach((kolonne) => {
      const fagListe = kolonne.fag.map((id) => fagIndex.find((f) => f.id === id)).filter(Boolean);
      const kolonneEl = document.createElement("div");
      kolonneEl.className = "fag-kolonne";
      kolonneEl.innerHTML = `<h3 class="fag-gruppe-titel">${kolonne.navn}</h3>`;
      const stak = document.createElement("div");
      stak.className = "fag-stak";
      fagListe.forEach((fag) => stak.appendChild(fagFeltKort(fag, alle, kolonne)));
      kolonneEl.appendChild(stak);
      raekkeEl.appendChild(kolonneEl);
    });
    oversigt.appendChild(raekkeEl);
  });
  return oversigt;
}
