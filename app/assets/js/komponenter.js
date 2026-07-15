// Delte DOM-komponenter: kort, dækningsgradsprofil, tomme pladser (fold), fagbånd.

import { familieFor, fagNavn, FAMILIER, DIMENSIONER, DIM_NAVNE, antalAabnePladser, datoTekst, kaede, gisselDefinition, klassetrinTilInterval } from "./data.js";

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

export function fagBaand(alle) {
  const wrap = document.createElement("div");
  wrap.className = "fagbaand";
  const taellinger = {};
  for (const fam of Object.keys(FAMILIER)) taellinger[fam] = 0;
  alle.forEach((f) => taellinger[familieFor(f.fag)]++);
  for (const [fam, def] of Object.entries(FAMILIER)) {
    const a = document.createElement("a");
    a.className = "fagfelt";
    a.dataset.fag = fam;
    // Familie er igen en browse.html-facet (taksonomi-shape D4.2, dateret
    // genåbning af arkitektur 7.2 — søgeintentionen er nu dokumenteret).
    a.href = `browse.html?familie=${fam}`;
    // Den fulde fagliste (11+ navne pr. familie) er støj, ikke information —
    // familien selv + antal er nok til at orientere (Valdemar, 2026-07-14).
    a.innerHTML = `
      <div class="fagnavn">${def.navn}</div>
      <div class="fagantal">${taellinger[fam]} forløb &rarr;</div>
    `;
    wrap.appendChild(a);
  }
  return wrap;
}
