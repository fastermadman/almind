// Delt header: ét modul erstatter otte hardkodede kopier (navigation-plan §1).
// Kaldes: sitehoved(document.querySelector(".site-header")) — data-aktiv
// (forside|browse|upload) styrer aktiv-markering; udelades for sider uden
// naturligt nav-punkt (sequence/rediger/preview/graph/fag).

// "Forside" udelades bevidst: logo-klik = forside er en kendt konvention,
// et redundant nav-link tilføjer kun støj (Valdemar, 2026-07-14).
const NAV_LINKS = [
  { href: "index.html#fag", tekst: "Fag", aktiv: null }, // anker, markeres aldrig aktivt
  { href: "browse.html", tekst: "Forløb", aktiv: "browse" },
];

// id="soeg" gives kun ét sted — to matchende id'er ville gøre
// browse.html's document.getElementById("soeg") ambigiøs.
function soegeform(medId) {
  const form = document.createElement("form");
  form.className = "soegeform";
  form.action = "browse.html";
  form.setAttribute("role", "search");
  const input = document.createElement("input");
  input.className = "soegefelt";
  if (medId) input.id = "soeg";
  input.name = "q";
  input.type = "search";
  input.placeholder = "Søg forløb ...";
  input.setAttribute("aria-label", "Søg i forløb");
  form.appendChild(input);
  return form;
}

function navLinks(aktiv, luk) {
  const links = NAV_LINKS.map((l) => {
    const a = document.createElement("a");
    a.href = l.href;
    a.textContent = l.tekst;
    if (l.aktiv && l.aktiv === aktiv) a.className = "aktiv";
    // Anker-klik på "Fag" fra forsiden udløser ingen sidelæsning — luk
    // mobilmenuen manuelt, ellers står den åben.
    if (luk && l.href.includes("#")) a.addEventListener("click", luk);
    return a;
  });
  const del = document.createElement("a");
  del.className = "knap";
  del.href = "upload.html";
  del.textContent = "Del et forløb";
  links.push(del);
  return links;
}

export function sitehoved(el) {
  if (!el) return;
  const aktiv = el.dataset.aktiv || null;
  el.innerHTML = "";

  const logo = document.createElement("a");
  logo.className = "logo";
  logo.href = "index.html";
  logo.innerHTML = 'almind<small>frit, fælles &amp; forgrenet</small>';
  el.appendChild(logo);

  el.appendChild(soegeform(true));

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Hovednavigation");
  navLinks(aktiv, null).forEach((a) => nav.appendChild(a));
  el.appendChild(nav);

  // Mobilmenu: native <details> — MPA'en navigerer ved valg, så menuen
  // "lukker" af sig selv ved sidelæsning (navigation-plan §3).
  const detaljer = document.createElement("details");
  detaljer.className = "mobilmenu";
  const summary = document.createElement("summary");
  summary.textContent = "Menu";
  detaljer.appendChild(summary);
  const mobilNav = document.createElement("nav");
  mobilNav.setAttribute("aria-label", "Hovednavigation");
  mobilNav.appendChild(soegeform(false));
  const luk = () => detaljer.removeAttribute("open");
  navLinks(aktiv, luk).forEach((a) => mobilNav.appendChild(a));
  detaljer.appendChild(mobilNav);
  el.appendChild(detaljer);
}
