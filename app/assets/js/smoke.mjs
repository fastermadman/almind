// ponytail: ingen testframework — node built-in assert er nok for pure functions
// data.js henter fag-index.json via fetch() ved modul-load (FAMILIER); i node
// mockes fetch til at læse den samme fil lokalt, så familieFor testes mod ægte data.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
globalThis.fetch = async (url) => {
  const fil = readFileSync(path.join(DIR, "../../data", url.replace(/^data\//, "")), "utf8");
  return { json: async () => JSON.parse(fil) };
};

const { familieFor, findForloeb, kaede, datoTekst, antalAabnePladser } = await import("./data.js");
await new Promise((r) => setTimeout(r, 0)); // lad _familieIndlaesning-fetchet fuldføre

let fejl = 0;
function tjek(beskrivelse, udtryk) {
  if (!udtryk) { console.error(`FEJL: ${beskrivelse}`); fejl++; }
}

// --- familieFor ---
tjek("dansk → sprog",     familieFor("dansk") === "sprog");
tjek("historie → kultur", familieFor("historie") === "kultur");
tjek("geografi → natur",  familieFor("geografi") === "natur");
tjek("musik → aes",       familieFor("musik") === "aes");
tjek("ukendt → ovr",      familieFor("XYZ") === "ovr");

// --- findForloeb ---
const data = [
  { id: "a", fork_af: null,        forks: ["b"], fag: "dansk", tomme_pladser: [], titel: "A" },
  { id: "b", fork_af: { id: "a" }, forks: [],     fag: "dansk", tomme_pladser: [{}, {}], titel: "B" },
];
tjek("findForloeb finder", findForloeb(data, "a")?.id === "a");
tjek("findForloeb null",   findForloeb(data, "X") === null);

// --- kaede ---
const k = kaede(data, "b");
tjek("kaede fra barn finder rod", k[0]?.id === "a");
tjek("kaede indeholder begge",    k.length === 2);

// Cycle-testcase (guardet af #98)
const cycle = [
  { id: "c", fork_af: { id: "d" }, forks: ["d"], fag: "dansk", tomme_pladser: [] },
  { id: "d", fork_af: { id: "c" }, forks: ["c"], fag: "dansk", tomme_pladser: [] },
];
const kc = kaede(cycle, "c");
tjek("kaede terminerer ved cyklus",     kc.length <= cycle.length);
tjek("kaede returnerer noget ved cyklus", kc.length > 0);

// --- antalAabnePladser ---
tjek("antalAabnePladser 2",            antalAabnePladser(data[1]) === 2);
tjek("antalAabnePladser 0",            antalAabnePladser(data[0]) === 0);
tjek("antalAabnePladser mangler felt", antalAabnePladser({}) === 0);

// --- datoTekst ---
const dt = datoTekst("2025-09-01");
tjek("datoTekst indeholder år",    dt.includes("2025"));
tjek("datoTekst indeholder måned", dt.toLowerCase().includes("september"));

if (fejl > 0) {
  console.error(`${fejl} test(s) fejlede.`);
  process.exit(1);
} else {
  console.log("OK");
}
