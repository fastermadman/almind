// Almind genealogi SVG
import { familieFor } from "./data.js";
const NODE_W = 130, NODE_H = 68, H_GAP = 52, V_GAP = 95;
export function horisontaltTrae(kaede, aktivtId) {
  const N = kaede.length, W = N * NODE_W + (N - 1) * H_GAP + 80, H = 160;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Forløbets genealogi" });
  svg.classList.add("kan-tegnes");
  const xs = kaede.map((_, i) => 40 + i * (NODE_W + H_GAP));
  for (let i = 0; i < N - 1; i++) {
    const x1 = xs[i] + NODE_W, x2 = xs[i + 1], y = H / 2;
    const mid = (x1 + x2) / 2;
    const p = el("path", { d: `M ${x1} ${y} C ${mid} ${y}, ${mid} ${y}, ${x2} ${y}`, class: "trae-gren" });
    const L = Math.sqrt((x2 - x1) ** 2);
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    svg.appendChild(p);
  }
  kaede.forEach((f, i) => {
    const x = xs[i], y = H / 2 - NODE_H / 2;
    const g = el("g", { class: "trae-node" + (f.id === aktivtId ? " aktiv" : ""), role: "link", tabindex: "0", "aria-label": `${f.version || f.id}: ${f.titel}` });
    g.addEventListener("click", () => { if (f.id !== aktivtId) location.href = `sequence.html?id=${f.id}`; });
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (f.id !== aktivtId) location.href = `sequence.html?id=${f.id}`; } });
    g.appendChild(el("rect", { x, y, width: NODE_W, height: NODE_H, rx: "12", fill: "var(--surface)", stroke: "var(--fagfarve)", "stroke-width": "2" }));
    const versTekst = f.version || (i === 0 ? "Original" : `v${i + 1}`);
    g.appendChild(svgTekst(versTekst, x + NODE_W / 2, y + 20, "node-version"));
    g.appendChild(svgTekst(f.undertitel || f.forfatter || "", x + NODE_W / 2, y + 38, "node-navn"));
    g.appendChild(svgTekst(f.aar ? String(f.aar) : "", x + NODE_W / 2, y + 53, "node-meta"));
    if (f.id === aktivtId) { const b = el("rect", { x: x + NODE_W - 34, y: y - 12, width: 32, height: 18, rx: "9", class: "trae-badge-ramme" }); g.appendChild(b); g.appendChild(svgTekst("▶ nu", x + NODE_W - 18, y - 1, "trae-badge")); }
    svg.appendChild(g);
  });
  return svg;
}
export function vertikaltTrae(kaede, aktivtId) {
  const N = kaede.length, W = 240, H = N * NODE_H + (N - 1) * V_GAP + 20;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  const ys = kaede.map((_, i) => 10 + i * (NODE_H + V_GAP));
  for (let i = 0; i < N - 1; i++) {
    const x = 20, y1 = ys[i] + NODE_H, y2 = ys[i + 1];
    svg.appendChild(el("line", { x1: x, y1, x2: x, y2, class: "trae-gren" }));
  }
  kaede.forEach((f, i) => {
    const y = ys[i]; const aktiv = f.id === aktivtId;
    const g = el("g", { class: "trae-node" + (aktiv ? " aktiv" : "") });
    g.appendChild(el("circle", { cx: "20", cy: String(y + NODE_H / 2), r: "10", fill: "var(--surface)", stroke: "var(--fagfarve)", "stroke-width": "2.5" }));
    const versTekst = f.version || (i === 0 ? "v0" : `v${i}`);
    g.appendChild(svgTekst(versTekst, 45, y + NODE_H / 2 - 9, "v-label"));
    const link = el("a", { href: `sequence.html?id=${f.id}`, "aria-current": aktiv ? "page" : undefined });
    const tTitel = el("text", { x: "45", y: String(y + NODE_H / 2 + 8), class: "v-titel", fill: "var(--ink)", "font-family": "var(--font-ui)", "font-weight": "600", "font-size": "14" });
    tTitel.textContent = f.undertitel || f.titel.slice(0, 22);
    link.appendChild(tTitel);
    g.appendChild(link);
    g.appendChild(svgTekst(`${f.forfatter} · ${f.aar || ""}`, 45, y + NODE_H / 2 + 24, "v-meta"));
    svg.appendChild(g);
  });
  return svg;
}
function el(tag, attrs = {}) { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v); return e; }
function svgTekst(tekst, x, y, cls) { const t = el("text", { x: String(x), y: String(y), class: cls, "text-anchor": "middle", fill: cls.includes("badge") ? "var(--fagtekst)" : cls.includes("navn") || cls.includes("meta") ? "var(--muted)" : "var(--ink)" }); t.textContent = tekst; return t; }