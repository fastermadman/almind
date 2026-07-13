// Datalag: forløb, fagfamilier, genealogi-hjælpere.

// fag-index.json er kilden til fagfamilier (26 fag, Fase D-leverance) — hentes
// og caches som hentManifest()/hentDestillat(). hentFagIndex() genbruger cachen
// for forbrugere der har brug for de fulde fag-index-poster (fx fag-dropdowns).
// Intet top-level await her: modulet importeres af næsten alle sider, og et
// hængende fetch må ikke blokere hele modulgrafen. hentForloeb() venter på
// FAMILIER internt, så de ti forbrugere der allerede "await hentForloeb()"
// får den gratis; graph.html (som læser FAMILIER FØR den kalder hentForloeb())
// venter selv via et lokalt "await hentFagIndex()" i sit eget script.
// Ordret fra Folkeskoleloven §5, stk. 2 (Valdemar, 2026-07-14) — ikke egne betegnelser
const FAMILIE_NAVN = { hum: "Humanistiske fag", natur: "Naturfag", aes: "Praktiske/musiske fag" };
const FAMILIE_NOEGLE = { humaniora: "hum", naturfag: "natur", "praktisk-musisk": "aes" };

export const FAMILIER = {};
let _fagIndex = null;
async function _fetchFagIndex() {
  if (!_fagIndex) {
    const svar = await fetch("data/fag-index.json");
    _fagIndex = await svar.json();
    for (const fag of _fagIndex) {
      const noegle = FAMILIE_NOEGLE[fag.familie] || "hum";
      if (!FAMILIER[noegle]) FAMILIER[noegle] = { navn: FAMILIE_NAVN[noegle], fag: [] };
      FAMILIER[noegle].fag.push(fag.id);
    }
  }
  return _fagIndex;
}
export async function hentFagIndex() {
  return _fetchFagIndex();
}
const _familieIndlaesning = _fetchFagIndex(); // starter fetchet straks ved modul-indlæsning

// Fuld fag-fil (trinforloeb, indholdsomraader, mål — Fase D-kontrakten, 6.1).
// Hentes kun hvor der er brug for den: wizard'ens trin-valg og kobling, fag-sider.
const _fagCache = {};
export async function hentFag(fagId) {
  if (!_fagCache[fagId]) {
    const svar = await fetch(`data/fag/${fagId}.json`);
    _fagCache[fagId] = await svar.json();
  }
  return _fagCache[fagId];
}

export const DIMENSIONER = ["maal", "indhold", "metode", "organisering", "differentiering", "evaluering"];
export const DIM_NAVNE = {
  maal: "Mål", indhold: "Indhold", metode: "Metode",
  organisering: "Organisering", differentiering: "Differentiering", evaluering: "Evaluering",
};

// Fasers bogstav (A, B, C, ...) er altid udledt af rækkefølgen ved
// visning — aldrig gemt. Dermed følger det automatisk med når faser
// trækkes rundt, uden noget separat at holde synkroniseret.
export function faseBogstav(i) {
  return String.fromCharCode(65 + i);
}

export function familieFor(fag) {
  for (const [noegle, fam] of Object.entries(FAMILIER)) {
    if (fam.fag.includes(fag)) return noegle;
  }
  return "hum";
}

let _forloeb = null;
export async function hentForloeb() {
  await _familieIndlaesning;
  if (!_forloeb) {
    const svar = await fetch("data/forloeb.json");
    _forloeb = await svar.json();
  }
  return _forloeb;
}

export function findForloeb(alle, id) {
  return alle.find((f) => f.id === id) || null;
}

// Hele kæden et forløb indgår i: op til roden, derefter alle generationer ned.
export function kaede(alle, id) {
  let node = findForloeb(alle, id);
  if (!node) return [];
  while (node.fork_af) {
    const forael = findForloeb(alle, node.fork_af.id);
    if (!forael) break; // brudt kæde: stop i stedet for at løkke uendeligt
    node = forael;
  }
  const resultat = [];
  const gaaNed = (f) => {
    resultat.push(f);
    (f.forks || []).forEach((fid) => {
      const barn = findForloeb(alle, fid);
      if (barn) gaaNed(barn);
    });
  };
  gaaNed(node);
  return resultat;
}

export function antalAabnePladser(f) {
  return (f.tomme_pladser || []).length;
}

export function datoTekst(iso) {
  const m = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"];
  const d = new Date(iso);
  return `${m[d.getMonth()]} ${d.getFullYear()}`;
}

// Kladden bor i localStorage: den overlever genstart. Én aktiv kladde ad
// gangen — flere forløb håndteres som JSON-filer (download/upload i editoren),
// samme form som målmodellen: ét forløb = én JSON-fil = ét fremtidigt repo.
export function gemKladde(kladde) {
  localStorage.setItem("almind_kladde", JSON.stringify(kladde));
}
// Issue #22: aktiviteter var en flad liste af strenge, er nu {titel,
// beskrivelse}. Kladder gemt før skiftet ligger stadig som strenge i
// localStorage — pakkes ud her, ved selve indlæsningen, så INGEN anden
// fil (blokke.js, dokument.js) behøver kende til det gamle format.
function normaliserAktiviteter(f) {
  (f.faser || []).forEach((fase) => {
    fase.aktiviteter = (fase.aktiviteter || []).map((a) =>
      typeof a === "string" ? { titel: "", beskrivelse: a } : a);
  });
  f.schema_version = f.schema_version || 1; // kladder fra før schema_version 2 er version 1, ikke en fejl
  return f;
}

export function hentKladde() {
  // sessionStorage-fallback: kladder fra før skiftet kan stadig åbnes
  const raa = localStorage.getItem("almind_kladde") || sessionStorage.getItem("almind_kladde");
  return raa ? normaliserAktiviteter(JSON.parse(raa)) : null;
}

// Destillater
let _manifest = null;
export async function hentManifest() {
  if (!_manifest) {
    const svar = await fetch("destillater/manifest.json");
    _manifest = await svar.json();
  }
  return _manifest;
}
const _destillatCache = {};
export async function hentDestillat(post) {
  if (!_destillatCache[post.id]) {
    const svar = await fetch("destillater/" + post.fil);
    _destillatCache[post.id] = await svar.json();
  }
  return _destillatCache[post.id];
}

// Materialetype-vokabularet læses fra destillatet (arkitektur 8.3: vokabular
// fra destillat-JSON, aldrig hardcodet). Værdierne ER destillatets egne nøgler
// i seks_kategorier — så gemte forløb kan altid slås op i teorigrundlaget.
export function materialetypeNavn(id) {
  return id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ") : "";
}
export async function gisselMaterialetyper() {
  const manifest = await hentManifest();
  const post = manifest.destillater.find((d) => d.id === "gissel-2026-typologi-laeremidler");
  if (!post) return [];
  const d = await hentDestillat(post);
  return Object.keys(d.seks_kategorier || {}).map((id) => ({ id, navn: materialetypeNavn(id) }));
}

// Bilag 1's tre former for fagligt samspil (destillat: bilag1-centrale-begreber-2026,
// begrebet "Tværfaglighed" — står som prosa dér, derfor struktureret her).
export const SAMSPIL_FORMER = [
  { id: "funktionelt", navn: "Funktionelt samspil", under: "et fag bruges som redskabsfag for et andet" },
  { id: "flerfagligt", navn: "Flerfagligt samspil", under: "parallelt arbejde med samme fænomen fra hvert sit fagperspektiv" },
  { id: "tvaerfagligt", navn: "Tværfagligt samspil", under: "fælles, fagligt integrerede mål om en kompleks problemstilling" },
];

// Gissel-definitioner til tomme pladser (fra dækningsgrad-destillatet)
export async function gisselDefinition(dimension) {
  const manifest = await hentManifest();
  const post = manifest.destillater.find((d) => d.id === "gissel-2024-daekningsgrad-og-analyse");
  if (!post) return null;
  const d = await hentDestillat(post);
  const map = {
    differentiering: d.begreber?.differentiering?.definition,
    evaluering: d.begreber?.didaktisk_daekningsgrad?.kritisk_pointe,
    organisering: d.begreber?.variation?.tre_planer?.[0]
      ? "Organiseringsformer er ét af variationens tre planer: " + d.begreber.variation.tre_planer.map((p) => p.eksempel).join(" · ")
      : null,
    metode: d.begreber?.didaktisk_laermiddel?.definition,
    maal: d.begreber?.didaktisk_laermiddel?.noeglepointe,
    indhold: d.begreber?.progression?.definition,
  };
  return map[dimension] || d.begreber?.didaktisk_daekningsgrad?.kritisk_pointe || null;
}
