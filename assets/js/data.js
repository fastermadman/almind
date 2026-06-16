// Almind data layer
export const FAMILIER = { dansk: "hum", engelsk: "hum", tysk: "hum", fransk: "hum", spansk: "hum", latin: "hum", oldtidskundskab: "hum", historia: "hum", historie: "hum", samfundsfag: "hum", religion: "hum", filosofi: "hum", psykologi: "hum", matematik: "stem", fysik: "stem", kemi: "stem", biologi: "natur", geografi: "natur", natur: "natur", naturvidenskab: "natur", idraet: "aes", musik: "aes", billedkunst: "aes", haandvaerk: "aes", design: "aes", madkundskab: "aes", drama: "aes", film: "aes" };
export const DIMENSIONER = ["maal", "indhold", "produkt", "aktiviteter", "tid", "evaluering"];
export const DIM_NAVNE = { maal: "Mål", indhold: "Indhold", produkt: "Produkt", aktiviteter: "Aktiviteter", tid: "Tid", evaluering: "Evaluering" };
export function familieFor(fag) { if (!fag) return "hum"; const k = fag.toLowerCase().replace(/\/.*/, "").trim(); for (const [n, f] of Object.entries(FAMILIER)) { if (k.includes(n)) return f; } return "hum"; }
export function datoTekst(iso) { if (!iso) return "ukendt dato"; try { return new Date(iso).toLocaleDateString("da-DK", { year: "numeric", month: "long", day: "numeric" }); } catch { return iso; } }
export async function hentForloeb() { const res = await fetch("data/forloeb.json"); return res.json(); }
export function findForloeb(alle, id) { return alle.find((f) => f.id === id); }
export function kaede(alle, id) { const f = findForloeb(alle, id); if (!f) return []; const rod = rodFor(alle, id); return alle.filter((x) => rodFor(alle, x.id) === rod).sort((a, b) => a.aar - b.aar || a.version?.localeCompare(b.version || "") || 0); }
function rodFor(alle, id) { let f = findForloeb(alle, id); while (f?.fork_af) f = findForloeb(alle, f.fork_af); return f?.id || id; }
export function antalAabnePladser(f) { return (f.tomme_pladser || []).length; }
export function hentKladde() { try { const r = sessionStorage.getItem("almind-kladde"); return r ? JSON.parse(r) : null; } catch { return null; } }
export function gemKladde(f) { try { sessionStorage.setItem("almind-kladde", JSON.stringify(f)); } catch {} }
export async function hentDestillat(fil) { const res = await fetch(fil); return res.json(); }
export async function hentAlleDestillater() { const res = await fetch("destillater/manifest.json"); const manifest = await res.json(); return Promise.all(manifest.map(async (m) => ({ ...m, data: await hentDestillat(m.fil) }))); }
export function gisselDefinition(dimensionsNoegle, destillater) { for (const d of destillater) { if (d.data?.dimensioner?.[dimensionsNoegle]) return { kilde: d.data.kilde || d.fil, def: d.data.dimensioner[dimensionsNoegle] }; } return null; }