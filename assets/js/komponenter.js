// Almind DOM komponenter
import { familieFor, DIMENSIONER, DIM_NAVNE, antalAabnePladser, kaede, hentAlleDestillater, gisselDefinition } from "./data.js";
let _destillater = null;
async function destillater() { if (!_destillater) _destillater = await hentAlleDestillater(); return _destillater; }
export function forloebKort(f, alle) {
  const fam = familieFor(f.fag);
  const a = document.createElement("a"); a.href = `sequence.html?id=${f.id}`; a.className = "kort"; a.dataset.fag = fam;
  const k = kaede(alle, f.id); const pladser = antalAabnePladser(f);
  a.innerHTML = `
    <div class="kort-tags">
      <span class="tag">${f.fag}</span>
      <span class="tag neutral">${f.klassetrin}</span>
      ${(f.tema || []).slice(0, 2).map((t) => `<span class="tag neutral">${t}</span>`).join("")}
    </div>
    <h3>${f.titel}${f.undertitel ? `<br><span style="font-size:0.88em;font-weight:400;color:var(--muted);">${f.undertitel}</span>` : ""}</h3>
    <p class="kort-beskrivelse">${f.beskrivelse || ""}</p>
    <div class="kort-bund">
      <span class="metadata">${f.forfatter} · ${f.institution}</span>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        ${pladser > 0 ? `<span class="plads-badge">${pladser} åb${pladser === 1 ? "en" : "ne"} plads${pladser === 1 ? "" : "er"}</span>` : ""}
        ${k.length > 1 ? miniGenealogi(k.length) : ""}
      </div>
    </div>`;
  return a;
}
function miniGenealogi(n) {
  const prikker = Array.from({ length: Math.min(n, 5) }, (_, i) => `<span class="prik${i === 0 ? " fyldt" : ""}"></span>`).join(`<span class="streg"></span>`);
  return `<div class="mini-genealogi" title="${n} versioner">${prikker}</div>`;
}
export function dgProfil(f) {
  const wrap = document.createElement("div"); wrap.className = "dg-profil";
  DIMENSIONER.forEach((dim) => {
    const v = f.dg?.[dim];
    const status = v === 2 ? "fuld" : v === 1 ? "delvis" : "tom";
    const prikker = v === 2 ? "●●" : v === 1 ? "●○" : "○○";
    const cls = v === 2 ? "p-fuld" : v === 1 ? "p-delvis" : "p-tom";
    const tekst = v === 2 ? "Fuldt dækket" : v === 1 ? "Delvist dækket" : "Åben plads";
    wrap.innerHTML += `<div class="dg-raekke" data-status="${status}"><span class="dg-navn">${DIM_NAVNE[dim]}</span><span class="dg-prikker ${cls}">${prikker}</span><span class="dg-status-tekst">${tekst}</span></div>`;
  });
  return wrap;
}
export function pladsFold(f, plads) {
  const det = document.createElement("details"); det.className = "plads";
  const sum = document.createElement("summary");
  sum.innerHTML = `<span class="fold-pil">▶</span><span class="plads-label">Åben plads: ${DIM_NAVNE[plads.dimension]}</span><span class="plads-preview">${plads.hvad || "Ikke specificeret"}</span>`;
  det.appendChild(sum);
  const krop = document.createElement("div"); krop.className = "plads-krop";
  krop.innerHTML = `<blockquote>${plads.hvad || "Ikke specificeret"}</blockquote><p style="font-size:0.88rem;margin-bottom:0.9rem;">${plads.hvorfor || ""}</p><a class="knap" href="fork.html?id=${f.id}&dimension=${plads.dimension}">Udfyld denne plads</a>`;
  det.appendChild(krop);
  det.addEventListener("toggle", async () => {
    if (det.open && !krop.querySelector(".gissel-def")) {
      const ds = await destillater();
      const def = gisselDefinition(plads.dimension, ds);
      if (def) { const d = document.createElement("p"); d.className = "gissel-def"; d.innerHTML = `<strong>${DIM_NAVNE[plads.dimension]}:</strong> ${def.def} <span class="destillat-kilde">(${def.kilde})</span>`; krop.insertBefore(d, krop.querySelector("a")); }
    }
  });
  return det;
}
export function fagBaand(alle) {
  const wrap = document.createElement("div"); wrap.className = "fagbaand";
  const FAMILIER_DATA = [{ id: "hum", navn: "Humaniora", fag: "dansk, engelsk, tysk, samfundsfag, religion, filosofi" }, { id: "stem", navn: "STEM", fag: "matematik, fysik, kemi" }, { id: "natur", navn: "Natur", fag: "biologi, geografi, naturvidenskab" }, { id: "aes", navn: "Æstetik", fag: "musik, billedkunst, indræt, design" }];
  for (const fam of FAMILIER_DATA) {
    const antal = alle.filter((f) => familieFor(f.fag) === fam.id).length;
    const a = document.createElement("a"); a.href = `browse.html?fam=${fam.id}`; a.className = "fagfelt"; a.dataset.fag = fam.id;
    a.innerHTML = `<div class="fagnavn">${fam.navn}</div><div class="fagfag">${fam.fag}</div><div class="fagantal">${antal} forløb</div>`;
    wrap.appendChild(a);
  }
  return wrap;
}