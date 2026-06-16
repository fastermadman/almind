// Datalag: forløb, fagfamilier, genealogi-hjælpere.

export const FAMILIER = {
  hum:   { navn: "Humaniora", fag: ["dansk", "historie", "religion"] },
  stem:  { navn: "STEM",      fag: ["matematik", "fysik", "teknik"] },
  natur: { navn: "Natur",     fag: ["natur/teknik", "geografi", "biologi"] },
  aes:   { navn: "Æstetik",   fag: ["musik", "billedkunst", "drama"] },
};

export const DIMENSIONER = ["maal", "indhold", "metode", "organisering", "differentiering", "evaluering"];
export const DIM_NAVNE = {
  maal: "Mål", indhold: "Indhold", metode: "Metode",
  organisering: "Organisering", differentiering: "Differentiering", evaluering: "Evaluering",
};

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

// Wizard-kladde via sessionStorage
export function gemKladde(kladde) {
  sessionStorage.setItem("almind_kladde", JSON.stringify(kladde));
}
export function hentKladde() {
  const raa = sessionStorage.getItem("almind_kladde");
  return raa ? JSON.parse(raa) : null;
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
