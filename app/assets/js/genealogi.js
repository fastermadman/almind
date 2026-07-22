// Genealogi-træ som inline SVG. Horisontal (forside-hero) og vertikal liste (sequence).
// Kæderne i seed-data er lineære; layoutet er bevidst simpelt (Karpathy: intet spekulativt).

import { antalAabnePladser } from "./data.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function el(navn, attrs = {}) {
  const e = document.createElementNS(SVG_NS, navn);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// Horisontalt træ: V0 ━━ V1 ━━ V2 med forfatter, år og pladser-badge.
export function horisontaltTrae(kaede, aktivId) {
  const n = kaede.length;
  const bredde = 560;
  const hoejde = 170;
  const margin = 60;
  const y = 62;
  const afstand = n > 1 ? (bredde - margin * 2) / (n - 1) : 0;

  // Ingen role="img": svg'en indeholder rigtige <a>-links (V0/V1/V2-noder),
  // og role="img" ville få skærmlæsere til at gengive dem som ét fladt billede
  // (axe-core "nested-interactive"). <title> giver et tilgængeligt navn uden
  // den konflikt — standardmønstret for SVG-tilgængelighed.
  const svg = el("svg", { viewBox: `0 0 ${bredde} ${hoejde}` });
  const svgTitel = el("title");
  svgTitel.textContent =
    "Versionshistorik: " +
    kaede.map((f, i) => `V${i} af ${f.forfatter} (${f.aar})`).join(", ");
  svg.appendChild(svgTitel);

  // Grene først (bag noderne)
  for (let i = 0; i < n - 1; i++) {
    const x1 = margin + i * afstand;
    const x2 = margin + (i + 1) * afstand;
    const sti = el("path", {
      d: `M ${x1 + 13} ${y} C ${x1 + afstand * 0.4} ${y - 26}, ${x2 - afstand * 0.4} ${y - 26}, ${x2 - 13} ${y}`,
      class: "trae-gren",
    });
    svg.appendChild(sti);
  }

  kaede.forEach((f, i) => {
    const x = margin + i * afstand;
    const led = el("a", { href: `sequence.html?id=${f.id}` });
    led.setAttribute("class", "trae-node" + (f.id === aktivId ? " aktiv" : ""));
    led.setAttribute("aria-label", `Version ${i}: ${f.forfatter}, ${f.aar}. ${antalAabnePladser(f)} åbne pladser.`);

    led.appendChild(el("circle", { cx: x, cy: y, r: 12 }));

    const version = el("text", { x, y: y - 24, "text-anchor": "middle", class: "node-version" });
    version.textContent = `V${i}`;
    led.appendChild(version);

    const navn = el("text", { x, y: y + 34, "text-anchor": "middle", class: "node-navn" });
    navn.textContent = f.forfatter_kort || f.forfatter.split(" ")[0];
    led.appendChild(navn);

    const meta = el("text", { x, y: y + 50, "text-anchor": "middle", class: "node-meta" });
    meta.textContent = `${f.institution} · ${f.aar}`;
    led.appendChild(meta);

    const pladser = antalAabnePladser(f);
    if (pladser > 0) {
      const btekst = `${pladser} ${pladser === 1 ? "åben plads" : "åbne pladser"}`;
      const bBredde = btekst.length * 6.2 + 16;
      led.appendChild(
        el("rect", {
          x: x - bBredde / 2, y: y + 60, width: bBredde, height: 20,
          rx: 10, class: "trae-badge-ramme",
        })
      );
      const badge = el("text", { x, y: y + 74, "text-anchor": "middle", class: "trae-badge" });
      badge.textContent = btekst;
      led.appendChild(badge);
    }

    svg.appendChild(led);
  });

  return svg;
}

// Vertikalt træ som semantisk liste (sequence.html).
export function vertikaltTrae(kaede, aktivId) {
  const ol = document.createElement("ol");
  ol.className = "vtrae";
  kaede.forEach((f, i) => {
    const li = document.createElement("li");
    if (f.id === aktivId) li.className = "aktiv";
    const pladser = antalAabnePladser(f);
    // E.5: fork_af.opdateret er den PINNEDE forælder-tilstand ved forkingen
    // (E.1) — afviger den fra forælderens NUVÆRENDE opdateret-dato, er
    // forælderen redigeret siden. Kæden (kaede) rummer altid forælderen.
    const forael = f.fork_af ? kaede.find((k) => k.id === f.fork_af.id) : null;
    const forladet = forael && forael.opdateret !== f.fork_af.opdateret;

    const label = document.createElement("span");
    label.className = "v-label";
    label.textContent = `V${i}`;

    const titelDiv = document.createElement("div");
    titelDiv.className = "v-titel";
    const titelLink = document.createElement("a");
    titelLink.href = `sequence.html?id=${f.id}`;
    titelLink.textContent = f.titel + (f.undertitel ? ": " + f.undertitel : "");
    titelDiv.appendChild(titelLink);

    const metaDiv = document.createElement("div");
    metaDiv.className = "v-meta";
    metaDiv.textContent = `${f.forfatter} · ${f.institution} · ${f.aar}${pladser ? ` · ${pladser} åbne pladser` : ""}`;

    li.append(label, titelDiv, metaDiv);

    if (f.diff) {
      const diffDiv = document.createElement("div");
      diffDiv.className = "v-diff";
      diffDiv.textContent = f.diff;
      li.appendChild(diffDiv);
    }
    if (forladet) {
      const forladetDiv = document.createElement("div");
      forladetDiv.className = "v-forladet";
      forladetDiv.textContent = `Forket fra en tidligere version af "${forael.titel}" — forælderen er redigeret siden`;
      li.appendChild(forladetDiv);
    }

    ol.appendChild(li);
  });
  return ol;
}
