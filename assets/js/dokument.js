// Almind preview dokument renderer
import { DIMENSIONER, DIM_NAVNE, familieFor, datoTekst } from "./data.js";
export function renderDokument(f, tilstand = "laerer") {
  const ark = document.createElement("article"); ark.className = `ark ${tilstand}`; ark.dataset.fag = familieFor(f.fag);
  ark.appendChild(kolofon(f, tilstand));
  if (tilstand === "laerer") {
    if (f.dg) ark.appendChild(dgSektion(f));
    if (f.faser?.length) ark.appendChild(faserSektion(f));
    if (f.tomme_pladser?.length) ark.appendChild(pladserSektion(f));
    if (f.materialer?.length) ark.appendChild(materialerSektion(f));
    if (f.citat) ark.appendChild(citatSektion(f));
  } else {
    ark.appendChild(elevForside(f));
    if (f.faser?.length) ark.appendChild(elevFaser(f));
  }
  ark.appendChild(fod(f));
  return ark;
}
function kolofon(f, tilstand) {
  const div = document.createElement("div"); div.className = "ark-kolofon";
  div.innerHTML = `<div><div class="ark-type">${tilstand === "laerer" ? "Lærervejledning" : "Elevmateriale"}</div><div class="ark-titel">${f.titel}${f.undertitel ? ` · ${f.undertitel}` : ""}</div><div class="ark-meta">${f.forfatter} · ${f.institution} · ${f.fag} · ${f.klassetrin} · opdateret ${datoTekst(f.opdateret)} · ${f.licens}</div></div>${tilstand === "laerer" ? dgKolofon(f) : ""}`;
  return div;
}
function dgKolofon(f) {
  if (!f.dg) return "";
  const linjer = DIMENSIONER.map((d) => { const v = f.dg[d]; const p = v === 2 ? "●●" : v === 1 ? "●○" : "○○"; return `<div class="dg-linje"><span class="prikker">${p}</span> ${DIM_NAVNE[d]}</div>`; }).join("");
  return `<div class="ark-dg">${linjer}</div>`;
}
function dgSektion(f) {
  const sek = document.createElement("section"); sek.innerHTML = `<h2>Didaktisk dækningsgrad</h2>`;
  const callout = document.createElement("div"); callout.className = "callout callout-gissel";
  callout.innerHTML = `<span class="callout-titel">Gissel 2024: Dækningsgrad som analyseredskab</span>Et forløbs didaktiske kvalitet kan aflæses af, hvilke dimensioner det dækker, og hvilke det overlader til lærerens valg. Åbne pladser er ikke fejl: de er invitationer til redidaktisering.`;
  sek.appendChild(callout);
  DIMENSIONER.forEach((dim) => {
    const v = f.dg[dim]; const status = v === 2 ? "fuld" : v === 1 ? "delvis" : "tom";
    const prikker = v === 2 ? "●●" : v === 1 ? "●○" : "○○";
    const p = document.createElement("p"); p.style.marginBottom = "0.35rem";
    p.innerHTML = `<strong>${DIM_NAVNE[dim]}</strong> <span style="letter-spacing:2px;">${prikker}</span> ${status === "fuld" ? "Fuldt dækket" : status === "delvis" ? "Delvist dækket" : "<em>Åben plads</em>"}`;
    sek.appendChild(p);
  });
  return sek;
}
function faserSektion(f) {
  const sek = document.createElement("section"); sek.innerHTML = `<h2>Forløbets faser</h2>`;
  f.faser.forEach((fase, i) => {
    const h = document.createElement("h3"); h.textContent = `Fase ${i + 1}: ${fase.titel}`; sek.appendChild(h);
    const p = document.createElement("p"); p.textContent = fase.beskrivelse; sek.appendChild(p);
    if (fase.aktiviteter?.length) { const ul = document.createElement("ul"); fase.aktiviteter.forEach((a) => { const li = document.createElement("li"); li.textContent = a; ul.appendChild(li); }); sek.appendChild(ul); }
    if (fase.dramaturgi) { const c = document.createElement("div"); c.className = "callout callout-dramaturgi"; c.innerHTML = `<span class="callout-titel">Brodersen: ${fase.dramaturgi.type}</span>${fase.dramaturgi.beskriv || ""}`; sek.appendChild(c); }
  });
  return sek;
}
function pladserSektion(f) {
  const sek = document.createElement("section"); sek.innerHTML = `<h2>Åbne pladser</h2>`;
  f.tomme_pladser.forEach((p) => {
    const boks = document.createElement("div"); boks.className = "aaben-plads-boks";
    boks.innerHTML = `<span class="boks-titel">Åben plads: ${DIM_NAVNE[p.dimension]}</span>${p.hvad || "Ikke specificeret"}<br><em>${p.hvorfor || ""}</em>`;
    sek.appendChild(boks);
  });
  return sek;
}
function materialerSektion(f) {
  const sek = document.createElement("section"); sek.innerHTML = `<h2>Materialer</h2>`;
  const ul = document.createElement("ul");
  f.materialer.forEach((m) => { const li = document.createElement("li"); li.innerHTML = `<strong>${m.type}:</strong> <a href="${m.url}">${m.titel}</a>${m.note ? ` — ${m.note}` : ""}`; ul.appendChild(li); });
  sek.appendChild(ul);
  return sek;
}
function citatSektion(f) {
  const sek = document.createElement("section");
  const bq = document.createElement("blockquote"); bq.style.cssText = "border-left:3px solid var(--fagfarve);padding-left:1rem;font-style:italic;margin:1.5rem 0;";
  bq.innerHTML = `"${f.citat.tekst}"<br><cite style="font-style:normal;font-size:0.85rem;">— ${f.citat.hvem}</cite>`;
  sek.appendChild(bq);
  return sek;
}
function elevForside(f) {
  const sek = document.createElement("section");
  sek.innerHTML = `<div class="maal-boks"><strong>Mål for dette forløb:</strong> ${f.dg?.maal === 2 ? "Klare mål er beskrevet i forløbet." : "Spørg din lærer om målene for dette forløb."}</div><p>${f.beskrivelse || ""}</p>`;
  return sek;
}
function elevFaser(f) {
  const sek = document.createElement("section"); sek.innerHTML = `<h2>Dine opgaver</h2>`;
  f.faser.forEach((fase, i) => {
    const h = document.createElement("h3"); h.textContent = `Trin ${i + 1}: ${fase.titel}`; sek.appendChild(h);
    const p = document.createElement("p"); p.textContent = fase.beskrivelse; sek.appendChild(p);
    if (fase.elevopgave) { const boks = document.createElement("div"); boks.className = "callout callout-valg"; boks.innerHTML = `<span class="callout-titel">Din opgave</span>${fase.elevopgave}`; sek.appendChild(boks); }
  });
  return sek;
}
function fod(f) {
  const div = document.createElement("div"); div.className = "ark-fod";
  div.innerHTML = `<span>almind.org · ${f.licens}</span><span>Hentet ${new Date().toLocaleDateString("da-DK")}</span>`;
  return div;
}