// Almind wizard (upload + fork)
import { DIMENSIONER, DIM_NAVNE, hentAlleDestillater, familieFor, gemKladde } from "./data.js";
const TRIN = [
  { id: "basis", navn: "Grundoplysninger" },
  { id: "dg", navn: "Dækningsgrad" },
  { id: "faser", navn: "Faser" },
  { id: "pladser", navn: "Åbne pladser" },
  { id: "del", navn: "Del" },
];
export async function startWizard({ rod, original = null, startDimension = null }) {
  const ds = await hentAlleDestillater();
  let trinNr = 0;
  const data = original ? deepKopi(original) : { id: genId(), faser: [], tomme_pladser: [], dg: {}, tags: {}, licens: "CC BY-SA 4.0" };
  if (original) { data.id = genId(); data.fork_af = original.id; delete data.forfatter; delete data.institution; }
  if (startDimension) { trinNr = TRIN.findIndex((t) => t.id === "dg"); if (trinNr < 0) trinNr = 0; }
  tegn();
  function tegn() {
    rod.innerHTML = "";
    rod.appendChild(progression(trinNr));
    const trin = TRIN[trinNr];
    const el = document.createElement("div");
    if (trin.id === "basis") el.appendChild(trinBasis(data, original));
    else if (trin.id === "dg") el.appendChild(trinDg(data, original, ds, startDimension));
    else if (trin.id === "faser") el.appendChild(trinFaser(data, original));
    else if (trin.id === "pladser") el.appendChild(trinPladser(data, original, ds));
    else if (trin.id === "del") el.appendChild(trinDel(data));
    el.appendChild(navRaekke(trinNr, TRIN.length, () => { if (trinNr > 0) { trinNr--; tegn(); } }, () => { gemData(); if (trinNr < TRIN.length - 1) { trinNr++; tegn(); } }));
    rod.appendChild(el);
  }
  function gemData() {
    rod.querySelectorAll("[data-felt]").forEach((inp) => {
      const felt = inp.dataset.felt;
      const val = inp.type === "checkbox" ? inp.checked : inp.value.trim();
      setNested(data, felt, val);
    });
    gemKladde(data);
  }
}
function progression(nr) {
  const wrap = document.createElement("div"); wrap.className = "wizard-progression";
  TRIN.forEach((_, i) => { const d = document.createElement("div"); d.className = "trin" + (i <= nr ? " naaet" : ""); d.title = TRIN[i].navn; wrap.appendChild(d); });
  return wrap;
}
function navRaekke(nr, total, tilbage, frem) {
  const wrap = document.createElement("div"); wrap.className = "wizard-nav";
  if (nr > 0) { const b = document.createElement("button"); b.className = "knap sekundaer"; b.textContent = "← Tilbage"; b.addEventListener("click", tilbage); wrap.appendChild(b); } else { wrap.appendChild(document.createElement("span")); }
  const f = document.createElement("button"); f.className = "knap"; f.textContent = nr < total - 1 ? "Videre →" : "Preview"; f.addEventListener("click", frem); wrap.appendChild(f);
  return wrap;
}
function trinBasis(data, original) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="wizard-trin-navn">Trin 1 · Grundoplysninger</p>`;
  wrap.appendChild(feltTekst("Forløbets titel", "titel", data.titel || "", original?.titel, "Hvad handler forløbet om?"));
  wrap.appendChild(feltTekst("Undertitel", "undertitel", data.undertitel || "", original?.undertitel, "Valgfrit: underoverskrift"));
  wrap.appendChild(feltTekst("Dit navn", "forfatter", data.forfatter || "", null, "Hvem har lavet dette forløb?"));
  wrap.appendChild(feltTekst("Institution", "institution", data.institution || "", original?.institution, "Skole eller organisation"));
  wrap.appendChild(feltTekst("Fag", "fag", data.fag || "", original?.fag, "Fx \"Dansk\" eller \"Dansk/musik\""));
  wrap.appendChild(feltTekst("Klassetrin", "klassetrin", data.klassetrin || "", original?.klassetrin, "Fx \"7.-9. klasse\""));
  wrap.appendChild(feltTextarea("Beskrivelse", "beskrivelse", data.beskrivelse || "", original?.beskrivelse, "En kort beskrivelse som andre lærere ser på forsiden."));
  wrap.appendChild(feltTekst("År", "aar", data.aar ? String(data.aar) : "", original?.aar ? String(original.aar) : "", "Hvornår er forløbet lavet eller sidst opdateret?"));
  return wrap;
}
function trinDg(data, original, ds, fremhaevDim) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="wizard-trin-navn">Trin 2 · Didaktisk dækningsgrad</p><p class="hjaelp">Angiv for hver dimension, i hvilken grad forløbet dækker den. Åbne pladser vises på forløbssiden som invitationer til redidaktisering.</p>`;
  DIMENSIONER.forEach((dim) => {
    const aaben = fremhaevDim === dim;
    const divOuter = document.createElement("div"); divOuter.className = "dim-vaelger" + (aaben ? " aaben" : "");
    const hoved = document.createElement("div"); hoved.className = "dim-hoved";
    const navn = document.createElement("span"); navn.className = "dim-navn"; navn.textContent = DIM_NAVNE[dim];
    const seg = document.createElement("div"); seg.className = "segment dim-skifter";
    [["0", "Ingen"], ["1", "Delvis"], ["2", "Fuld"]].forEach(([v, t]) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.setAttribute("aria-pressed", String((data.dg?.[dim] ?? 0) === Number(v)));
      b.addEventListener("click", () => { if (!data.dg) data.dg = {}; data.dg[dim] = Number(v); seg.querySelectorAll("button").forEach((btn) => btn.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true"); gemKladde(data); });
      seg.appendChild(b);
    });
    hoved.appendChild(navn); hoved.appendChild(seg); divOuter.appendChild(hoved);
    const kildeDef = ds.flatMap((d) => { const def = d.data?.dimensioner?.[dim]; return def ? [{ def, kilde: d.data.kilde || d.fil }] : []; })[0];
    if (kildeDef) { const p = document.createElement("p"); p.className = "destillat-kilde"; p.style.marginTop = "0.45rem"; p.textContent = `${DIM_NAVNE[dim]}: ${kildeDef.def.slice(0, 110)}... (${kildeDef.kilde})`; divOuter.appendChild(p); }
    wrap.appendChild(divOuter);
  });
  return wrap;
}
function trinFaser(data, original) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="wizard-trin-navn">Trin 3 · Faser</p>`;
  if (!data.faser) data.faser = [];
  const liste = document.createElement("div");
  function tegnFaser() {
    liste.innerHTML = "";
    (data.faser || []).forEach((fase, i) => {
      const p = document.createElement("div"); p.className = "panel"; p.style.marginBottom = "1rem";
      p.innerHTML = `<strong>Fase ${i + 1}</strong>`;
      const inp = document.createElement("input"); inp.type = "text"; inp.value = fase.titel || ""; inp.placeholder = "Fasetitel"; inp.style.cssText = "width:100%;margin:0.5rem 0;padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.95rem;";
      inp.addEventListener("input", () => { data.faser[i].titel = inp.value; gemKladde(data); });
      const ta = document.createElement("textarea"); ta.value = fase.beskrivelse || ""; ta.placeholder = "Beskrivelse af fasen ..."; ta.style.cssText = "width:100%;min-height:70px;padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.92rem;";
      ta.addEventListener("input", () => { data.faser[i].beskrivelse = ta.value; gemKladde(data); });
      const fjern = document.createElement("button"); fjern.type = "button"; fjern.textContent = "Fjern fase"; fjern.style.cssText = "font-size:0.8rem;color:var(--muted);background:none;border:none;cursor:pointer;margin-top:0.3rem;";
      fjern.addEventListener("click", () => { data.faser.splice(i, 1); gemKladde(data); tegnFaser(); });
      p.appendChild(inp); p.appendChild(ta); p.appendChild(fjern); liste.appendChild(p);
    });
  }
  tegnFaser();
  const tilfoej = document.createElement("button"); tilfoej.type = "button"; tilfoej.className = "knap sekundaer"; tilfoej.textContent = "+ Tilføj fase";
  tilfoej.addEventListener("click", () => { if (!data.faser) data.faser = []; data.faser.push({ titel: "", beskrivelse: "", aktiviteter: [] }); gemKladde(data); tegnFaser(); });
  wrap.appendChild(liste); wrap.appendChild(tilfoej);
  return wrap;
}
function trinPladser(data, original, ds) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="wizard-trin-navn">Trin 4 · Åbne pladser</p><p class="hjaelp">Dimensioner du har markeret som ikke fuldt dækket kan beskrives her. Det hjælper næste lærer at forstå, hvad der venter på redidaktisering.</p>`;
  if (!data.tomme_pladser) data.tomme_pladser = [];
  const tomme = DIMENSIONER.filter((d) => !data.dg?.[d] || data.dg[d] < 2);
  tomme.forEach((dim) => {
    const eks = (data.tomme_pladser || []).find((p) => p.dimension === dim) || { dimension: dim, hvad: "", hvorfor: "" };
    if (!data.tomme_pladser.find((p) => p.dimension === dim)) data.tomme_pladser.push(eks);
    const p = document.createElement("div"); p.className = "panel"; p.style.marginBottom = "1rem";
    const kildeDef = ds.flatMap((d) => { const def = d.data?.dimensioner?.[dim]; return def ? [{ def, kilde: d.data.kilde || d.fil }] : []; })[0];
    p.innerHTML = `<strong>${DIM_NAVNE[dim]}</strong>${kildeDef ? `<p class="destillat-kilde">${kildeDef.def.slice(0, 100)}... (${kildeDef.kilde})</p>` : ""}`;
    const inp1 = document.createElement("input"); inp1.type = "text"; inp1.placeholder = "Hvad er pladsen? (fx 'Vurderingsform ikke valgt')"; inp1.value = eks.hvad || ""; inp1.style.cssText = "width:100%;margin:0.5rem 0;padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.92rem;";
    inp1.addEventListener("input", () => { eks.hvad = inp1.value; gemKladde(data); });
    const inp2 = document.createElement("input"); inp2.type = "text"; inp2.placeholder = "Hvorfor er den åben?"; inp2.value = eks.hvorfor || ""; inp2.style.cssText = "width:100%;margin:0.5rem 0;padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.92rem;";
    inp2.addEventListener("input", () => { eks.hvorfor = inp2.value; gemKladde(data); });
    p.appendChild(inp1); p.appendChild(inp2); wrap.appendChild(p);
  });
  if (!tomme.length) { const ok = document.createElement("p"); ok.style.color = "var(--typ-green)"; ok.textContent = "✓ Alle dimensioner er dækket i dette forløb."; wrap.appendChild(ok); }
  return wrap;
}
function trinDel(data) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="wizard-trin-navn">Trin 5 · Del</p><h2 style="font-family:var(--font-display);font-size:1.5rem;margin-bottom:1rem;">Klar til preview</h2><p style="margin-bottom:1.5rem;">Forløbet er gemt midlertidigt i din browser. Du kan se det som et dokument, kopiere JSON-data, eller (når Alminds backend er klar) sende det direkte.</p>`;
  const preview = document.createElement("a"); preview.href = "preview.html?kladde=1"; preview.className = "knap"; preview.textContent = "Se preview";
  wrap.appendChild(preview);
  const kopi = document.createElement("button"); kopi.type = "button"; kopi.className = "knap sekundaer"; kopi.textContent = "Kopiér JSON"; kopi.style.marginLeft = "0.75rem";
  kopi.addEventListener("click", async () => { try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); kopi.textContent = "Kopiéret!"; setTimeout(() => (kopi.textContent = "Kopiér JSON"), 2000); } catch { kopi.textContent = "Fejl — prøv igen"; } });
  wrap.appendChild(kopi);
  return wrap;
}
function feltTekst(label, felt, val, orig, under) {
  const div = document.createElement("div"); div.className = "felt" + (orig !== undefined && orig !== null ? " arvet" : "");
  const lab = document.createElement("label"); lab.textContent = label + (orig !== undefined && orig !== null ? " " : "");
  if (orig !== undefined && orig !== null) { const m = document.createElement("span"); m.className = "arv-markering"; m.textContent = "(arvet)"; lab.appendChild(m); }
  const inp = document.createElement("input"); inp.type = "text"; inp.value = val; inp.dataset.felt = felt;
  inp.addEventListener("input", () => { div.classList.toggle("aendret", inp.value !== (orig || "")); });
  if (under) { const s = document.createElement("span"); s.className = "under"; s.textContent = under; div.appendChild(lab); div.appendChild(s); div.appendChild(inp); } else { div.appendChild(lab); div.appendChild(inp); }
  return div;
}
function feltTextarea(label, felt, val, orig, under) {
  const div = document.createElement("div"); div.className = "felt" + (orig !== undefined && orig !== null ? " arvet" : "");
  const lab = document.createElement("label"); lab.textContent = label;
  const ta = document.createElement("textarea"); ta.value = val; ta.dataset.felt = felt;
  ta.addEventListener("input", () => { div.classList.toggle("aendret", ta.value !== (orig || "")); });
  if (under) { const s = document.createElement("span"); s.className = "under"; s.textContent = under; div.appendChild(lab); div.appendChild(s); div.appendChild(ta); } else { div.appendChild(lab); div.appendChild(ta); }
  return div;
}
function setNested(obj, sti, val) { const dele = sti.split("."); let ptr = obj; for (let i = 0; i < dele.length - 1; i++) { ptr[dele[i]] = ptr[dele[i]] || {}; ptr = ptr[dele[i]]; } ptr[dele[dele.length - 1]] = val; }
function genId() { return "forloeb-" + Math.random().toString(36).slice(2, 9); }
function deepKopi(o) { return JSON.parse(JSON.stringify(o)); }