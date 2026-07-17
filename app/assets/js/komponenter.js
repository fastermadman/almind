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
  const miniGenealogi =
    k.length > 1
      ? `<span class="mini-genealogi" title="${k.length} versioner">` +
        k.map((v, i) =>
            `<span class="prik${v.id === f.id ? " fyldt" : ""}"></span>` +
            (i < k.length - 1 ? `<span class="streg"></span>` : "")
          ).join("") +
        `</span>`
      : "";

  const pladser = antalAabnePladser(f);
  const omfang = omfangTekst(f.omfang);
  const klassetrinInterval = klassetrinTilInterval(f.klassetrin);

  a.innerHTML = `
    <div class="kort-tags">
      <a class="tag" href="fag.html?id=${f.fag}">${fagNavn(f.fag)}</a>
      ${klassetrinInterval
        ? `<a class="tag neutral" href="browse.html?klassetrin=${klassetrinInterval[0]}">${f.klassetrin}</a>`
        : `<span class="tag neutral">${f.klassetrin}</span>`}
      ${f.demo ? `<span class="tag neutral">Eksempel</span>` : ""}
    </div>
    <h3><a class="kort-titel-link" href="sequence.html?id=${f.id}">${f.titel}</a></h3>
    <p class="kort-beskrivelse">${f.beskrivelse}</p>
    <div class="metadata">${f.forfatter} · ${datoTekst(f.opdateret)}${omfang ? ` · ${omfang}` : ""}</div>
    <div class="kort-bund">
      ${miniGenealogi || `<span class="metadata">1 version</span>`}
      ${pladser ? `<span class="plads-badge">${pladser} ${pladser === 1 ? "åben plads" : "åbne pladser"}</span>` : ""}
    </div>
  `;
  a.appendChild(gemKnap(f.id));
  return a;
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
  d.innerHTML = `
    <summary>
      <span class="fold-pil">&#9654;</span>
      <span class="plads-label">Åben plads: ${DIM_NAVNE[plads.dimension] || plads.dimension}</span>
      <span class="plads-preview">${plads.besked}</span>
    </summary>
    <div class="plads-krop">
      <blockquote>${plads.besked}<br><span class="metadata">${f.forfatter}</span></blockquote>
      <p class="gissel-def" data-dim="${plads.dimension}"></p>
      <a class="knap fag" href="rediger.html?fork=${f.id}&dimension=${plads.dimension}">Fork herfra</a>
    </div>
  `;
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
