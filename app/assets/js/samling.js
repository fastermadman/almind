// #54: "Gem til senere" — anonym, device-lokal samling af forløb-id'er.
// Samme mønster som forfatter-kladden (localStorage, ingen konto, ingen
// server) — består som fallback for ikke-logget-ind besøgende.
// #85: er man logget ind, spejles samlingen til Codeberg (samme fork som
// delTilAlmind/gemTilEgenGren bruger, jf. forgejo.js), så den følger
// brugeren på tværs af enheder. localStorage forbliver den øjeblikkelige
// kilde — intet klik venter på et netværkskald.

const NOEGLE = "almind_samling";
let _synkroniseret = false; // én pull-og-forening pr. sideindlæsning er nok

export function hentSamling() {
  try {
    return JSON.parse(localStorage.getItem(NOEGLE) || "[]");
  } catch {
    return [];
  }
}

function gemLokalt(samling) {
  localStorage.setItem(NOEGLE, JSON.stringify(samling));
}

// Henter Codeberg-udgaven (hvis logget ind) og forener med den lokale — en
// anonym samling gemt FØR login skal ikke forsvinde. Best-effort: fejler
// tavst (offline, udløbet login, endnu ingen Codeberg-samling), localStorage
// består altid uanset. dispatcher "samling-synkroniseret" på document, så
// allerede tegnede gem-knapper kan opdatere sig selv, hvis synkroniseringen
// ændrede noget efter første tegning.
async function synkroniser() {
  if (_synkroniseret) return;
  _synkroniseret = true;
  try {
    const { erLoggetInd, hentSamlingFraCodeberg } = await import("./forgejo.js");
    if (!erLoggetInd()) return;
    const fjern = await hentSamlingFraCodeberg();
    if (!fjern) return;
    const foer = hentSamling();
    const forenet = [...new Set([...foer, ...fjern])];
    if (forenet.length === foer.length && forenet.every((id) => foer.includes(id))) return;
    gemLokalt(forenet);
    document.dispatchEvent(new CustomEvent("samling-synkroniseret"));
  } catch (fejl) {
    // localStorage består uanset — Codeberg er et spejl, ikke kilden
    console.warn("Kunne ikke hente \"gem til senere\" fra Codeberg:", fejl);
  }
}
synkroniser();

export function erGemt(id) {
  return hentSamling().includes(id);
}

// Returnerer den nye tilstand (true = nu gemt, false = nu fjernet).
export function skiftGemt(id) {
  const samling = hentSamling();
  const i = samling.indexOf(id);
  if (i === -1) samling.push(id); else samling.splice(i, 1);
  gemLokalt(samling);
  // Baggrunds-spejling — blokerer aldrig klikket. Fejl logges (console.warn),
  // men kaster ikke: en mislykket Codeberg-sync må aldrig fremstå som en
  // fejlet stjerne-klik, det virkede jo lokalt.
  import("./forgejo.js").then(({ erLoggetInd, gemSamlingTilCodeberg }) => {
    if (erLoggetInd()) {
      gemSamlingTilCodeberg(samling)
        .catch((fejl) => console.warn("Kunne ikke synkronisere \"gem til senere\" til Codeberg:", fejl));
    }
  });
  return i === -1;
}

// Delt knap-opsætning: bruges af kort (browse/fag/forside) og sequence.html.
export function gemKnap(id) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "gem-knap";
  const opdater = () => {
    const gemt = erGemt(id);
    b.setAttribute("aria-pressed", String(gemt));
    b.setAttribute("aria-label", gemt ? "Fjern fra gemte forløb" : "Gem til senere");
    b.title = gemt ? "Fjern fra gemte forløb" : "Gem til senere";
    b.innerHTML = gemt ? "&#9733;" : "&#9734;"; // ★ / ☆
  };
  b.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); // aldrig udløs kortets stretched-link
    skiftGemt(id);
    opdater();
    b.dispatchEvent(new CustomEvent("samling-aendret", { bubbles: true }));
  });
  document.addEventListener("samling-synkroniseret", opdater);
  opdater();
  return b;
}
