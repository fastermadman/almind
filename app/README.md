# Almind demo: Fable-web-v1

Lokal demo af Almind-commons. Version A (Genealogien) med fold-interaktion og datadrevet preview lånt fra Version C, jf. `Fable-notes/00_SAMMENLIGNING.md`.

## Kør demoen

```bash
cd Fable-web-v1
python3 -m http.server 8080
# åbn http://localhost:8080
```

Kræver netadgang første gang (Google Fonts). Alt andet er lokalt, ingen build-step, ingen dependencies.

## Struktur

```
index.html      forside: hero med fork-træ (Den Svære Samtale V0-V1-V2), fagbånd, kortgrid
browse.html     galleri med filtre (fagfamilie, åbne pladser, versionshistorik), delbare URL-filtre
sequence.html   forløbsdetalje: vertikal genealogi, dækningsgradsprofil, tomme pladser som folder
upload.html     destillat-drevet wizard, 5 trin, slutter med "hvilke pladser lader du stå åbne?"
fork.html       samme wizard, forudfyldt fra original med arvet/dit bidrag-markering
preview.html    den egoistiske grund: forløb renderet som printklart dokument (Typst-fortolkning)
data/forloeb.json          14 forløb (se "Seed-data" nedenfor)
destillater/               5 af de 22 destillater + manifest.json
assets/css + assets/js     tokens, komponenter, 6 små ES-moduler, ingen frameworks
```

## Seed-data: hvad der er ægte og hvad der er opfundet

**Ægte (fra vaulten, revideret efter Temaer v2-refleksionsnoterne):** Den Svære Samtale V0/V1/V2 (inkl. det empiriske V1-til-V2-fund om deltagelses- og autonomitærskler) og de fem temaer: Mundtlighed (stemthed/tekståbner/dilemmaspil/metafase), Læsning (Djævelens Lærling: anslag/modellering/De Fantastiske 4/tekstkritiker), Skrivning (Troldenes tid: dagbog/undskyldning/breve), Kortfilm (anslag/begrebsliggørelse/vendingen/produktion), Journalistik (krystalnatsleder/Entman/spørgsmålstrappen/de 5 F'er). Formuleringerne er kondenseret fra refleksionsnoterne og skal stadig godkendes.

**mitCFU-integration:** Tema 2 linker til Djævelens lærling (e-bog CFUEBOG1100877, lydbog, Gyldendal-vejledning), Tema 3 til Troldenes tid (faust 140451339). Princip: ophavsretsbeskyttet materiale bor hos CFU, Almind ejer det didaktiske lag. Links vises på forløbssiden og printes med i dokumentet.

**Opfundne (på Valdemars anmodning, så alle fagfamilier er repræsenteret):** Brøkværkstedet (matematik), Strøm i huset (fysik), Åen bag skolen (natur/teknik), Vejret over Danmark (geografi), Stomp og polyrytmik (musik), Plakaten der råber (billedkunst). Troværdige men fiktive, inkl. forfatternavne.

## Designbeslutninger implementeret

Neutral base + fire fagfarver (bordeaux #8a2e3e for æstetik), neutralt logo, ingen femte platformfarve. Bricolage Grotesque (logo), Jost (UI), Atkinson Hyperlegible Next (al brødtekst), Noto Serif (udskolingsoverskrifter), mono-fallback for Drafting Mono. Ingen em-tankestreger i UI. Motion: moderat, fork-træet tegner sig selv, prefers-reduced-motion respekteret overalt. Preview-callouts er tro mod Typst-systemets egne farver.

## Kendte begrænsninger

1. Drafting Mono loades ikke (woff2 skal selvhostes); ui-monospace som fallback.
2. Marauder og No Tears er ikke i brug: alle seed-forløb er udskoling. Indskolings-preview er fase 2.
3. Alle 23 destillater medfølger nu (E.2, 2026-07-11) — kopieret fra `50_Almind/Almind-Wizard/destillater/`, manifest.json udvidet tilsvarende.
4. Wizard-kladden bor i sessionStorage: den overlever genindlæsning men ikke lukket fane. Demo-vilkår.
5. Bordeaux-tekstvarianten #5a1e2a er ikke formelt kontrasttjekket endnu.
6. **Browser-testing:** den lokale preview-cache kan servere stale `fetch()`-svar (fx `manifest.json`, `fag-index.json`) selv efter filen er ændret på disk — overlever `location.reload(true)` og nye faner på samme origin. Kun en ny origin (fx anden port) eller `fetch(url, {cache:'no-store'})` omgår det pålideligt. Ramt gentagne gange under E.2/E.3b/E.5 — tjek dette FØRST hvis en ændring "ikke ses" i browseren, før koden mistænkes.

## Næste skridt (Sonnet-polish)

Gennemspil alle seks views i browser, tjek konsol for fejl, godkend seed-tekster, kontrasttjek, evt. selvhostede fonte til offline-fremvisning, optag demo-video.
