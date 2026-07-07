// Greb-katalog v1: et greb er FORUDFYLDTE BLOKKE — én mekanisme, tre niveauer
// (makro = forløbsskelet, meso = rytme over flere blokke, mikro = enkelt teknik).
// Efter indsættelse er blokkene 100% almindelige: redigér, flyt, slet frit.
// Kildemærkatet er metadata, aldrig en lås (greb-bibliotek-skitsen, beslutning 3).
// Alt indhold er citeret fra data/forloeb.json eller skitsens strukturbeskrivelser
// — intet opfundet. Sonnet-udtræk + Fable-review mod korpus, 2026-07-07.
//
// Kataloget selv gemmer stadig aktiviteter som flade strenge (Issue #22
// landede 2026-07-07: aktiviteter er nu {titel, beskrivelse} i selve
// skemaet) — bevidst valg, ikke en glemt migrering: blokke.js's
// indsaetGreb()/somAktivitet() pakker strengene ind ved selve
// indsættelsen, så kataloget her forbliver det letteste at læse og udvide.
// Kilde-mærkatet rider stadig kun med på callouts, ikke på aktiviteter.

export const GREB_KATALOG = [
  {
    type: "greb",
    niveau: "makro",
    navn: "Brodersens dramaturgiske arkitektur",
    kilde: "Brodersen (2021)",
    kilde_type: "teoretisk_model",
    udfolder_til: "faser", // appender disse 4 til f.faser — erstatter aldrig (destruktivt)
    forudfyldt_indhold: [
      { titel: "Anslag", beskrivelse: "Begivenheden der skaber øjeblikkelig opmærksomhed og aktiverer forforståelsen.", aktiviteter: [], callouts: [] },
      { titel: "Uddybning", beskrivelse: "Indholdet bygges lag på lag — Deweys ophobning.", aktiviteter: [], callouts: [] },
      { titel: "Vendingen", beskrivelse: "Point of no return: eleven ytrer sig i eget navn, eksponeringen er reel.", aktiviteter: [], callouts: [] },
      { titel: "Ud af værket", beskrivelse: "Begreberne navngiver strukturen eleverne selv er en del af — fastholdelse som produktiv aktivering.", aktiviteter: [], callouts: [] },
    ],
    linser: [{ navn: "Deweys erfaringskvaliteter", kilde: "Dewey" }],
  },
  {
    type: "greb",
    niveau: "meso",
    navn: "Zig-zag-rytmen",
    kilde: "Tufte, via Brodersen/Gissel",
    kilde_type: "teoretisk_model",
    udfolder_til: "aktiviteter", // indsættes i én valgt fase, i denne rækkefølge
    // Korpus-belæg: tema3 "Zigzag-revision i makkerpar", tema2 "Zigzag mellem
    // analytisk-receptiv og analytisk-produktiv virksomhed".
    forudfyldt_indhold: ["Analyse", "Produktion", "Respons", "Revision"],
    linser: [],
  },
  {
    type: "greb",
    niveau: "mikro",
    navn: "Spørgsmålstrappen",
    kilde: "Grib Litteraturen",
    kilde_type: "udgivet_vaerk",
    udfolder_til: "aktivitet_plus_callout",
    // Uddraget direkte fra data/forloeb.json, tema5-journalistik, fase 3:
    forudfyldt_indhold: {
      aktiviteter: ["Gruppeanalyse af to telegrammer", "Spørgsmålstrappen bestiges", "Stillingtagen i plenum"],
      callout: {
        type: "obs",
        titel: "Biasdetektoren er selv en diskurs",
        tekst: "Lad ikke redskabet blive en facitliste. Det øjeblik eleverne vender Entman mod selve undervisningen, er ikke en afsporing; det er målet.",
      },
    },
    linser: [{ navn: "Entmans framing (4 spørgsmål)", kilde: "Entman (1993)" }],
  },
  {
    type: "greb",
    niveau: "mikro",
    navn: "Modellering",
    kilde: "Egen praksis (T2, 8.D)",
    kilde_type: "egen_praksis",
    udfolder_til: "aktivitet_plus_callout",
    // Uddraget direkte fra data/forloeb.json, tema2-laesning, fase "Modellering":
    forudfyldt_indhold: {
      aktiviteter: ["Læreren tænker højt over en nøglescene", "Eleverne prøver samme bevægelse på næste scene"],
      callout: {
        type: "valg",
        titel: "Svar på en kulturel diagnose",
        tekst: "Hayles dokumenterer at digitale medier træner hyper attention. Modellering genopbygger den deep attention fordybet læsning kræver. Det er ikke støtte til svage elever; det er kulturarbejde for alle.",
      },
    },
    linser: [{ navn: "Hyper/deep attention", kilde: "Hayles" }],
  },
];
