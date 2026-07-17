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

export async function login() {
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
  sessionStorage.setItem("cb_retur", location.pathname + location.search);

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
async function sikrSkriveRepo(mig) {
  if (mig === OPHAV.ejer) return { ejer: OPHAV.ejer, repo: OPHAV.repo };
  const f = await api(`/repos/${OPHAV.ejer}/${OPHAV.repo}/forks`, { method: "POST", body: "{}" });
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
  const findes = await api(`/repos/${ejer}/${repo}/contents/forloeb.json?ref=${encodeURIComponent(gren)}`);
  const basis = findes.ok ? await findes.json()
    : await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json?ref=main`);
  await apiOk(`/repos/${ejer}/${repo}/contents/forloeb.json`, {
    method: "PUT",
    body: JSON.stringify({
      content: b64utf8(JSON.stringify(forloeb, null, 2)),
      sha: basis.sha,
      ...(findes.ok ? { branch: gren } : { branch: "main", new_branch: gren }),
      message: `Del med klassen: ${forloeb.titel || "forløb"} (${mig} via almind.org)`,
    }),
  });
  return `elev.html?kilde=${ejer}/${repo}/${gren}`;
}
