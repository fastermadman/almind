// #54: "Gem til senere" — anonym, device-lokal samling af forløb-id'er.
// Samme mønster som forfatter-kladden (localStorage, ingen konto, ingen
// server). Overlever ikke device-skift — det er forventet, ikke en mangel.

const NOEGLE = "almind_samling";

export function hentSamling() {
  try {
    return JSON.parse(localStorage.getItem(NOEGLE) || "[]");
  } catch {
    return [];
  }
}

export function erGemt(id) {
  return hentSamling().includes(id);
}

// Returnerer den nye tilstand (true = nu gemt, false = nu fjernet).
export function skiftGemt(id) {
  const samling = hentSamling();
  const i = samling.indexOf(id);
  if (i === -1) samling.push(id); else samling.splice(i, 1);
  localStorage.setItem(NOEGLE, JSON.stringify(samling));
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
  opdater();
  return b;
}
