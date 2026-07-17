// Forgejo/Codeberg-persistensklient: login via OAuth2 PKCE (public client,
// ingen secret — jf. almind-blok-arkitektur.md og Forgejos egen dokumentation),
// derefter fork/branch → commit → PR via Forgejo-API'et.
// Ingen dependencies: PKCE bruger WebCrypto, alt andet er fetch.
//
// Målmodellen: ét forløb = én JSON-fil = ét repo. I dag findes ét seed-repo
// (almind/dss-v1); OPHAV peger derpå. Når kataloget vokser, afledes OPHAV af
// forløbets id i stedet.

const BASE = "https://codeberg.org";
const CLIENT_ID = "54cf58d8-a21d-40f9-a3aa-de406031d021"; // public client — ikke hemmelig
const OPHAV = { ejer: "almind", repo: "dss-v1" };

// RFC 8252: loopback-redirect skal være 127.0.0.1, ikke localhost i dev
// (Forgejo håndhæver anbefalingen). Vigtigere endnu: sessionStorage er
// origin-bundet, så code_verifier gemt på localhost ikke kan læses når
// callbacken lander på 127.0.0.1 — derfor tvinges dev-origin til 127.0.0.1
// før login. I produktion er der kun ét muligt domæne: samme origin som
// siden selv køres fra.
const ER_DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const REDIRECT = ER_DEV
  ? "http://127.0.0.1:8080/app/auth-callback.html"
  : `${location.origin}/app/auth-callback.html`;

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64utf8(s) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export function erLoggetInd() {
  return !!sessionStorage.getItem("cb_token");
}

export function logUd() {
  ["cb_token", "cb_refresh", "cb_login"].forEach((k) => sessionStorage.removeItem(k));
}

// retur: hvor OAuth-turen skal lande brugeren. rediger.html SKAL altid sende
// "rediger.html?kladde=1" eksplicit her — ellers tolker editoren OAuth-turen
// som "start forfra" og en gemt kladde forsvinder synligt, selvom den stadig
// ligger i localStorage. Andre sider (fx header-loginknappen) har ingen kladde
// at miste og kan trygt falde tilbage til den side, brugeren faktisk stod på.
export async function login(retur) {
  if (location.hostname === "localhost") {
    // origin-skiftet SKAL ske før verifier gemmes — se note ved REDIRECT
    location.href = location.href.replace("//localhost", "//127.0.0.1");
    return;
  }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32))); // 43 tegn, jf. RFC 7636
  const challenge = b64url(new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));

  sessionStorage.setItem("cb_verifier", verifier);
  sessionStorage.setItem("cb_state", state);
  sessionStorage.setItem("cb_retur", retur || (location.pathname + location.search));

  location.href = `${BASE}/login/oauth/authorize?` + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });
}

// Kaldes af auth-callback.html. Returnerer stien brugeren kom fra.
export async function haandterCallback() {
  const p = new URLSearchParams(location.search);
  if (p.get("error")) {
    throw new Error(p.get("error_description") || p.get("error"));
  }
  if (!p.get("code") || p.get("state") !== sessionStorage.getItem("cb_state")) {
    throw new Error("Ugyldigt callback (manglende kode eller state-mismatch). Prøv at logge ind igen.");
  }
  const res = await fetch(`${BASE}/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      code: p.get("code"),
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
      code_verifier: sessionStorage.getItem("cb_verifier"),
    }),
  });
  if (!res.ok) {
    throw new Error(`Token-indløsning fejlede (${res.status}): ${await res.text()}`);
  }
  const tok = await res.json();
  sessionStorage.setItem("cb_token", tok.access_token);
  if (tok.refresh_token) sessionStorage.setItem("cb_refresh", tok.refresh_token);
  sessionStorage.removeItem("cb_verifier");
  sessionStorage.removeItem("cb_state");
  const retur = sessionStorage.getItem("cb_retur") || "rediger.html";
  sessionStorage.removeItem("cb_retur");
  return retur;
}

// ---------- API-lag ----------

async function api(sti, opts = {}) {
  const res = await fetch(`${BASE}/api/v1${sti}`, {
    ...opts,
    headers: {
      "Authorization": "token " + sessionStorage.getItem("cb_token"),
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logUd();
    throw new Error("Login er udløbet — log ind med Codeberg igen.");
  }
  return res;
}

async function apiOk(sti, opts) {
  const res = await api(sti, opts);
  if (!res.ok) throw new Error(`${opts?.method || "GET"} ${sti} fejlede (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function hentBruger() {
  if (sessionStorage.getItem("cb_login")) return sessionStorage.getItem("cb_login");
  const mig = await apiOk("/user");
  sessionStorage.setItem("cb_login", mig.login);
  return mig.login;
}

// Repoet der kan skrives i: egen fork af ophavet — oprettes hvis den mangler.
// Er brugeren selv ophavets ejer (kan ikke forke eget repo), bruges ophavet
// direkte — samme mønster som git-værter selv.
async function sikrSkriveRepo(mig, opts = {}) {
  if (mig === OPHAV.ejer) return { ejer: OPHAV.ejer, repo: OPHAV.repo };
  const f = await api(`/repos/${OPHAV.ejer}/${OPHAV.repo}/forks`, { method: "POST", body: "{}", ...opts });
  if (f.ok) {
    const fork = await f.json();
    return { ejer: fork.owner.login, repo: fork.name };
  }
  if (f.status === 409) {
    // 409 = fork findes allerede; ponytail: antag da standardnavnet.
    // Slå-op-i-fork-listen tilføjes hvis omdøbte forks viser sig i praksis.
    return { ejer: mig, repo: OPHAV.repo };
  }
  throw new Error(`Fork fejlede (${f.status}): ${await f.text()}`);
}

// Fork → commit → PR i ét flow.
export async function delTilAlmind(forloeb) {
  const mig = await hentBruger();
  forloeb.forfatter_codeberg = mig; // #53: attribution-link — klienten kender jo det indloggede login
  const { ejer, repo } = await sikrSkriveRepo(mig);

  // Filens sha på main er påkrævet for opdatering; new_branch skaber grenen
  // og committer i samme kald.
  const fil = await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json?ref=main`);
  const gren = "forslag-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json`, {
    method: "PUT",
    body: JSON.stringify({
      content: b64utf8(JSON.stringify(forloeb, null, 2)),
      sha: fil.sha,
      branch: "main",
      new_branch: gren,
      message: `Forslag: ${forloeb.titel || "forløb"} (${mig} via almind.org)`,
    }),
  });

  const pr = await apiOk(`/repos/${OPHAV.ejer}/${OPHAV.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Forslag: ${forloeb.titel || "forløb"}`,
      head: ejer === OPHAV.ejer ? gren : `${ejer}:${gren}`,
      base: "main",
      body: (forloeb.beskrivelse || "Redigeret via almind.org") + "\n\nDelt under CC BY-SA 4.0.",
    }),
  });
  return pr.html_url;
}

// #56 "Del med klassen": commit til en navngiven gren i egen fork — INGEN PR,
// at dele med sin klasse er ikke et forslag til fællesskabet. Grennavnet
// gemmes på forløbet (klasse_gren), så rettelser committer til SAMME gren:
// elev-linket peger på grenen, ikke et commit, og forbliver derfor stabilt.
export async function gemTilEgenGren(forloeb) {
  const mig = await hentBruger();
  forloeb.forfatter_codeberg = mig;
  const { ejer, repo } = await sikrSkriveRepo(mig);

  if (!forloeb.klasse_gren) {
    const slug = (forloeb.titel || "forloeb").toLowerCase()
      .replace(/[æå]/g, "a").replace(/ø/g, "o")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "forloeb";
    forloeb.klasse_gren = `klasse-${slug}-${b64url(crypto.getRandomValues(new Uint8Array(3)))}`;
  }
  const gren = forloeb.klasse_gren;

  // Findes grenen: opdatér filen på den. Ellers: skab gren + commit i ét kald.
  // /branches/{navn} er den utvetydige eksistens-tjek — contents?ref=<ukendt gren>
  // faldt i praksis tilbage til main-indholdet med 200 i stedet for at 404'e,
  // hvilket fik PUT'en (som IKKE er tilgivende) til at fejle med "branch does not exist".
  const grenFindes = (await api(`/repos/${ejer}/${repo}/branches/${encodeURIComponent(gren)}`)).ok;
  const basis = await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json?ref=${encodeURIComponent(grenFindes ? gren : "main")}`);
  await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json`, {
    method: "PUT",
    body: JSON.stringify({
      content: b64utf8(JSON.stringify(forloeb, null, 2)),
      sha: basis.sha,
      ...(grenFindes ? { branch: gren } : { branch: "main", new_branch: gren }),
      message: `Del med klassen: ${forloeb.titel || "forløb"} (${mig} via almind.org)`,
    }),
  });
  return `elev.html?kilde=${ejer}/${repo}/${gren}`;
}

// #85: "gem til senere" (samling.js) spejlet til Codeberg ved login — samme
// fork-infrastruktur som delTilAlmind/gemTilEgenGren (sikrSkriveRepo), bare
// samling.json på main i stedet for forloeb.json på en gren (det er ikke en
// deling, kun personlig lagring, så ingen ny gren er nødvendig).
export async function hentSamlingFraCodeberg() {
  const mig = await hentBruger();
  const { ejer, repo } = await sikrSkriveRepo(mig);
  const res = await api(`/repos/${ejer}/${repo}/contents/samling.json?ref=main`);
  if (!res.ok) return null; // findes ikke endnu — første gang denne bruger gemmer noget
  const fil = await res.json();
  const bytes = Uint8Array.from(atob(fil.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// keepalive: true på ALLE kald i denne kæde — kaldes fra en stjerne-klik,
// hvor brugeren meget vel navigerer videre inden for millisekunder (naturligt
// at klikke stjernen og straks klikke ind i forløbet). Uden keepalive
// afbryder browseren fetch-kæden ved sideskift, og skrivningen når aldrig
// frem — det var præcis det, der skete (samling.json fandtes slet ikke på
// Codeberg, selvom UI'et virkede lokalt).
export async function gemSamlingTilCodeberg(ids) {
  const opts = { keepalive: true };
  const mig = await hentBruger();
  const { ejer, repo } = await sikrSkriveRepo(mig, opts);
  const findes = await api(`/repos/${ejer}/${repo}/contents/samling.json?ref=main`, opts);
  const sha = findes.ok ? (await findes.json()).sha : undefined;
  // Forgejo/Codeberg skelner mellem opret og opdatér — modsat GitHub, hvor PUT
  // dækker begge. PUT uden sha giver 422 "[SHA]: Required"; opret skal være
  // POST. delTilAlmind/gemTilEgenGren ramte aldrig dette, fordi forloeb.json
  // altid findes i forvejen (sha er altid sat) — samling.json er den første
  // fil, koden reelt opretter fra bunden.
  await apiOk(`/repos/${ejer}/${repo}/contents/samling.json`, {
    method: sha ? "PUT" : "POST",
    ...opts,
    body: JSON.stringify({
      content: b64utf8(JSON.stringify(ids)),
      ...(sha ? { sha } : {}),
      branch: "main",
      message: "Opdatér gemte forløb",
    }),
  });
}

// #82: Codeberg er ikke et kendt navn for en VIA-studerende — forklar hvad og
// hvorfor, FØR den uforklarede omstilling til et fremmed domæne, i stedet for
// at redirecte instant. Vises kun første gang (localStorage), så den ikke
// generer en bruger der allerede har set den og vil dele igen.
const FORKLARET_KEY = "almind_login_forklaret";

export function loginMedForklaring(retur) {
  if (localStorage.getItem(FORKLARET_KEY)) { login(retur); return; }

  const dlg = document.createElement("dialog");
  dlg.className = "login-dialog";
  const h2 = document.createElement("h2");
  h2.textContent = "Hvorfor Codeberg?";
  dlg.appendChild(h2);
  const p = document.createElement("p");
  p.className = "under";
  p.textContent = "Almind har ingen egen brugerdatabase — dit login og dine bidrag bor på "
    + "Codeberg, en uafhængig, non-profit git-tjeneste (samme slags system som GitHub, men "
    + "fri og fællesejet, ligesom Almind selv). Ingen Big Tech-konto, ingen sporing — og dine "
    + "data ligger et sted du selv kan tage med dig.";
  dlg.appendChild(p);

  const knapper = document.createElement("div");
  knapper.className = "login-dialog-knapper";
  const fortsaet = document.createElement("button");
  fortsaet.type = "button";
  fortsaet.className = "knap";
  fortsaet.textContent = "Fortsæt til Codeberg";
  fortsaet.addEventListener("click", () => {
    localStorage.setItem(FORKLARET_KEY, "1");
    dlg.close(); dlg.remove();
    login(retur);
  });
  knapper.appendChild(fortsaet);
  const annuller = document.createElement("button");
  annuller.type = "button";
  annuller.className = "knap sekundaer";
  annuller.textContent = "Ikke nu";
  annuller.addEventListener("click", () => { dlg.close(); dlg.remove(); });
  knapper.appendChild(annuller);
  dlg.appendChild(knapper);

  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  // Tvungen reflow (ikke rAF — den kan være throttlet i en baggrundsfane/
  // headless kontekst og aldrig fyre) committer opacity:0-udgangspunktet FØR
  // .vis lægges på, så transitionen har noget at interpolere fra.
  dlg.offsetHeight;
  dlg.classList.add("vis");
}
