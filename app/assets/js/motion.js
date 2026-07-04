// Motion: én IntersectionObserver, reduced-motion respekteres overalt.

export const reduceretMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const observer = new IntersectionObserver(
  (poster) => {
    poster.forEach((p) => {
      if (p.isIntersecting) {
        p.target.classList.add("in-view");
        observer.unobserve(p.target);
      }
    });
  },
  { threshold: 0.25 }
);

export function observe(el) {
  if (reduceretMotion) {
    el.classList.add("in-view");
    return;
  }
  observer.observe(el);
}

// Stagger: sæt voksende transition-delay på en liste af elementer.
export function stagger(elementer, trinMs = 50) {
  elementer.forEach((el, i) => {
    el.classList.add("reveal");
    if (!reduceretMotion) el.style.transitionDelay = `${i * trinMs}ms`;
    observe(el);
  });
}

// Tegn SVG-grene når træet kommer i view (stroke-dashoffset).
// Grenene tegnes sekventielt: V0 til V1, derefter V1 til V2 (transition-delay pr. gren).
export function tegnTrae(svg) {
  const grene = svg.querySelectorAll(".trae-gren");
  if (reduceretMotion) return;
  grene.forEach((g, i) => {
    const laengde = g.getTotalLength();
    g.style.strokeDasharray = laengde;
    g.style.strokeDashoffset = laengde;
    g.style.transitionDelay = `${i * 0.5}s`;
  });
  svg.classList.add("kan-tegnes");
  // Tving reflow så starttilstanden er anvendt, inden transitionen udløses.
  svg.getBoundingClientRect();
  const io = new IntersectionObserver(
    (poster) => {
      poster.forEach((p) => {
        if (p.isIntersecting) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              grene.forEach((g) => (g.style.strokeDashoffset = "0"));
            });
          });
          io.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  io.observe(svg);
}
