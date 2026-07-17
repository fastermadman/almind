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

// Læsefremskridt: erstatter headerens statiske border-bottom med en linje,
// der vokser med scroll — fagfarvet når siden har én fagkontekst (data-fag på
// en ancestor, jf. tokens.css), ellers Alminds egen --accent via CSS-fallback.
// Delt i sitehoved.js så den virker på alle sider uden separat opsætning pr. side.
function laesefremskridt() {
  const bar = document.createElement("div");
  bar.className = "laesefremskridt";
  const opdater = () => {
    const scrollbart = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const andel = scrollbart > 0 ? window.scrollY / scrollbart : 1;
    bar.style.width = `${Math.min(1, Math.max(0, andel)) * 100}%`;
  };
  document.addEventListener("scroll", opdater, { passive: true });
  window.addEventListener("resize", opdater);
  opdater();
  return bar;
}

// #84: rigtig brugermenu, ikke bare et log ud-tegn — #82's første version
// klarede sig med et "×" ved brugernavnet, men det holder ikke når der er
// mere end log ud at vælge mellem (profil, gemte forløb). Native <details>,
// samme mønster som mobilmenuen. Async status-tjek importerer forgejo.js
// dovent, så sider der aldrig rører login ikke betaler for det ved
// indlæsning. En frisk menu pr. kald, så samme markup kan sidde både i
// desktop-navet og mobilmenuen.
function brugerMenu() {
  const detaljer = document.createElement("details");
  detaljer.className = "brugermenu";
  const summary = document.createElement("summary");
  summary.className = "knap sekundaer header-login-knap";
  summary.textContent = "Log ind";
  detaljer.appendChild(summary);

  import("./forgejo.js").then(async ({ erLoggetInd, hentBruger, loginMedForklaring, logUd }) => {
    if (!erLoggetInd()) {
      // <details> skal ikke folde ud til en tom menu for en ikke-logget-ind
      // bruger — klik trigger login direkte i stedet.
      summary.addEventListener("click", (e) => { e.preventDefault(); loginMedForklaring(); });
      return;
    }
    let brugernavn;
    try {
      brugernavn = await hentBruger();
    } catch {
      summary.textContent = "Log ind";
      summary.addEventListener("click", (e) => { e.preventDefault(); loginMedForklaring(); });
      return;
    }
    summary.textContent = brugernavn;

    const liste = document.createElement("nav");
    liste.className = "brugermenu-liste";
    liste.setAttribute("aria-label", "Brugermenu");

    const profil = document.createElement("a");
    profil.href = `profil.html?bruger=${encodeURIComponent(brugernavn)}`;
    profil.textContent = "Min profil";
    liste.appendChild(profil);

    const gemte = document.createElement("a");
    gemte.href = "browse.html?gemte=1";
    gemte.textContent = "Gemte forløb";
    liste.appendChild(gemte);

    const udKnap = document.createElement("button");
    udKnap.type = "button";
    udKnap.textContent = "Log ud";
    udKnap.addEventListener("click", () => { logUd(); location.reload(); });
    liste.appendChild(udKnap);

    detaljer.appendChild(liste);

    // <details> lukker sig ikke selv ved klik udenfor (i modsætning til
    // popover-API'et) — en hængende åben menu er forvirrende.
    document.addEventListener("click", (e) => {
      if (!detaljer.contains(e.target)) detaljer.removeAttribute("open");
    });
  });

  return detaljer;
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
  nav.appendChild(brugerMenu());
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
  mobilNav.appendChild(brugerMenu());
  detaljer.appendChild(mobilNav);
  el.appendChild(detaljer);

  el.appendChild(laesefremskridt());
}
