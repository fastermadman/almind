// Delte DOM-komponenter: kort, dækningsgradsprofil, tomme pladser (fold), fagbånd.

import { familieFor, FAMILIER, DIMENSIONER, DIM_NAVNE, antalAabnePladser, datoTekst, kaede, gisselDefinition } from "./data.js";

export function forloebKort(f, alle) {
  const fam = familieFor(f.fag);
  const a = document.createElement("a");
  a.className = "kort";
  a.href = `sequence.html?id=${f.id}`;
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

  a.innerHTML = `
    <div class="kort-tags">
      <span class="tag">${f.fag}</span>
      <span class="tag neutral">${f.klassetrin}</span>
    </div>
    <h3>${f.titel}</h3>
    <p class="kort-beskrivelse">${f.beskrivelse}</p>
    <div class="metadata">${f.forfatter} · ${datoTekst(f.opdateret)}</div>
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
      <a class="knap fag" href="fork.html?id=${f.id}&dimension=${plads.dimension}">Fork herfra</a>
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
    a.href = `browse.html?fam=${fam}`;
    const fagliste = def.fag.map((fx) => fx[0].toUpperCase() + fx.slice(1)).join(" · ");
    a.innerHTML = `
      <div class="fagnavn">${def.navn}</div>
      <div class="fagfag">${fagliste}</div>
      <div class="fagantal">${taellinger[fam]} forløb &rarr;</div>
    `;
    wrap.appendChild(a);
  }
  return wrap;
}
