// Datalag: forløb, fagfamilier, genealogi-hjælpere.

export const FAMILIER = {
  hum:   { navn: "Humaniora",       fag: ["dansk", "historie", "religion"] },
  natur: { navn: "Natur & teknik",  fag: ["natur/teknik", "geografi", "biologi", "matematik", "fysik", "teknik"] },
  aes:   { navn: "Praktisk/Musisk", fag: ["musik", "billedkunst", "drama"] },
};

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
  while (node.fork_af) node = findForloeb(alle, node.fork_af) || node;
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
