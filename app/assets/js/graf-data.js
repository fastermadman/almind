// E-G0: graph.json-kontrakten, bygget klient-side. Samme form som en fremtidig
// CI-bygget graph.json (E-G5) skal have — graph.html bliver forbruger af
// bygGraf() (E-G1), rører ikke selv forloeb.json/fag-filerne direkte længere.
// Skema-eksempel: data/graph-schema.jsonc.

import { hentForloeb, hentFag, hentFagIndex, familieFor } from "./data.js";

// Nære relationer: redaktionelt kurateret (samme liste som graph.html havde).
const NAER_KANTER = [
  { source: "tema1-mundtlighed", target: "dss-v1", type: "naer", lag: "deklareret",
    note: "Dilemmaspillet er fase 3 i temaet — udskilt som selvstændigt forløb med egen genealogi." },
  { source: "tema1-mundtlighed", target: "tema2-laesning", type: "naer", lag: "deklareret",
    note: "Samme klasse, samme forår: 8.D, Silkeborg." },
  { source: "tema2-laesning", target: "tema3-skrivning", type: "naer", lag: "deklareret",
    note: "Samme klasse, samme forår: 8.D, Silkeborg." },
  { source: "tema3-skrivning", target: "tema4-kortfilm", type: "naer", lag: "deklareret",
    note: "Samme klasse, samme forår: 8.D, Silkeborg." },
  { source: "tema4-kortfilm", target: "tema5-journalistik", type: "naer", lag: "deklareret",
    note: "Samme klasse, samme forår: 8.D, Silkeborg." },
];

// Svage tværfaglige kanter: redaktionelt kurateret, interim (se skema-filens
// note) — beholder deres oprindelige type (plads|metode|empiri) indtil E-G1/
// E-G2 erstatter dem med rigtige begrebs-noder + "begreb"-kanter.
const SVAGE_KANTER = [
  { source: "dss-v2", target: "stroem-i-huset", type: "plads", lag: "deklareret", deler: "differentiering",
    forklaring: "To fag der aldrig mødes i et fagteam — og begge forløb lader præcis samme dør stå åben. Lukas: »den didaktik der flytter mønstret, er stadig en åben plads.« Anders: »fejlfindingsopgaverne findes kun i én sværhedsgrad.« Ingen af dem kender din klasse. Det gør du." },
  { source: "tema2-laesning", target: "broekvaerkstedet", type: "plads", lag: "deklareret", deler: "evaluering",
    forklaring: "Et fortolkningsfællesskab i dansk og et brøkværksted i matematik — begge slutter med materiale der kunne bære en evaluering, og begge overlader formen til den næste lærer. Den der bygger formen ét sted, har sandsynligvis bygget den begge steder." },
  { source: "tema3-skrivning", target: "aaen-bag-skolen", type: "plads", lag: "deklareret", deler: "organisering — stedet",
    forklaring: "Begge forløb står og falder med et konkret sted: skoven bag fiktionen, åen bag skolen. Og begge nægter at planlægge stedet for dig — fordi det ikke kan planlægges på afstand. Stedet er din plads." },
  { source: "dss-v1", target: "stomp-skolegaarden", type: "metode", lag: "deklareret", deler: "kollektiv form uden facit",
    forklaring: "Standpunktskift på signal og polyrytmisk lagdeling er samme didaktiske greb: en fælles struktur hvor turtagningen selv er indholdet, og hvor ingen enkelt stemme har facit. Den der har styret det ene rum, kan styre det andet." },
  { source: "tema4-kortfilm", target: "plakaten-der-raaber", type: "metode", lag: "deklareret", deler: "analysens vending til produktion",
    forklaring: "Raskins parametre og virkemiddeljagten vendes begge om: det redskab der afslørede andres valg, bliver elevens eget designværktøj. Den der har analyseret en overraskelse, ved hvad det koster at skabe én." },
  { source: "tema5-journalistik", target: "vejret-over-danmark", type: "empiri", lag: "deklareret", deler: "to kilder, samme virkelighed",
    forklaring: "Reuters mod Ritzau. Klassens målinger mod DMI. Samme empiriske fundament: hold to fremstillinger af samme virkelighed op mod hinanden, og lad afvigelsen være det der undervises i." },
];

// Begreb-id: slug af det normaliserede tema-navn (lowercase, trim, æøå bevaret
// — de er gyldige i URL-fragmenter/JS-objektnøgler, ingen grund til at translitterere).
function begrebId(tema) {
  return tema.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function bygGraf() {
  const alle = await hentForloeb();
  const fagIndex = await hentFagIndex();

  // ---------- forløbs-noder ----------
  const noder = alle.map((f) => ({
    id: f.id, type: "forloeb", navn: f.titel,
    fag: f.fag, klassetrin: f.klassetrin, familie: familieFor(f.fag),
  }));

  // ---------- begrebs-noder: normaliserede tema-felter, dedupereret ----------
  const begrebNavn = new Map(); // id → første forekomst af det originale (trimmede) navn
  alle.forEach((f) => (f.tema || []).forEach((t) => {
    const trimmet = t.trim();
    if (!trimmet) return;
    const id = begrebId(trimmet);
    if (!begrebNavn.has(id)) begrebNavn.set(id, trimmet);
  }));
  begrebNavn.forEach((navn, id) => noder.push({ id, type: "begreb", navn, begrebstype: "tema", ung: false }));

  // ---------- begreb-kanter: forløb → dets temaer ----------
  const begrebKanter = [];
  alle.forEach((f) => (f.tema || []).forEach((t) => {
    const trimmet = t.trim();
    if (!trimmet) return;
    begrebKanter.push({ source: f.id, target: begrebId(trimmet), type: "begreb", lag: "deklareret" });
  }));

  // ---------- fork-kanter: strukturelt udledt af fork_af ----------
  const forkKanter = alle.filter((f) => f.fork_af).map((f) => ({
    source: f.fork_af.id, target: f.id, type: "fork", lag: "strukturel",
    af: f.forfatter, dato: String(f.aar), diff: f.diff || null, citat: f.citat || null,
  }));

  // ---------- fagplan-kanter: strukturelt udledt af fag-filernes faelles_med ----------
  const unikkeFag = [...new Set(alle.map((f) => f.fag))];
  const fagFiler = {};
  for (const fagId of unikkeFag) {
    try { fagFiler[fagId] = await hentFag(fagId); } catch { /* ukendt/opfundet fag-id uden fag-fil */ }
  }
  const fagNavnRigtigt = (id) => fagIndex.find((x) => x.id === id)?.navn || id;
  const fagParOmraader = new Map(); // "fagA|fagB" (sorteret) → Set af delte områdenavne
  for (const [fagId, fagFil] of Object.entries(fagFiler)) {
    for (const omr of fagFil?.indholdsomraader || []) {
      for (const delerMed of omr.faelles_med || []) {
        if (!fagFiler[delerMed]) continue; // intet forløb i det fag endnu — ingen node at forbinde til
        const noeg = [fagId, delerMed].sort().join("|");
        if (!fagParOmraader.has(noeg)) fagParOmraader.set(noeg, new Set());
        fagParOmraader.get(noeg).add(omr.navn);
      }
    }
  }
  const fagplanKanter = [...fagParOmraader].map(([noeg, omraader]) => {
    const [fagA, fagB] = noeg.split("|");
    const a = alle.find((f) => f.fag === fagA);
    const b = alle.find((f) => f.fag === fagB);
    if (!a || !b) return null;
    const navne = [...omraader].join('", "');
    return {
      source: a.id, target: b.id, type: "fagplan", lag: "strukturel", deler: [...omraader].join(", "),
      forklaring: `${fagNavnRigtigt(fagA)} og ${fagNavnRigtigt(fagB)} deler indholdsområdet "${navne}" i fagplanen — en strukturel kobling fra fag-filerne, ikke en redaktionel kuratering.`,
    };
  }).filter(Boolean);

  return {
    nodes: noder,
    edges: [...forkKanter, ...NAER_KANTER, ...SVAGE_KANTER, ...fagplanKanter, ...begrebKanter],
  };
}
