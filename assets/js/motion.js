// Almind motion & animation
export function observe(el, cls = "in-view") {
  if (!el) return;
  const io = new IntersectionObserver((entries, obs) => { entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add(cls); obs.unobserve(e.target); } }); }, { threshold: 0.12 });
  el.classList.add("reveal");
  io.observe(el);
}
export function stagger(els, delayMs = 45) {
  const io = new IntersectionObserver((entries, obs) => { entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); obs.unobserve(e.target); } }); }, { threshold: 0.05 });
  els.forEach((el, i) => { el.classList.add("reveal"); el.style.transitionDelay = `${i * delayMs}ms`; io.observe(el); });
}
export function tegnTrae(svg) {
  if (!svg) return;
  const grene = [...svg.querySelectorAll(".trae-gren")];
  if (!grene.length) return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    grene.forEach((g, i) => {
      const len = g.getTotalLength ? g.getTotalLength() : parseFloat(g.getAttribute("x2") || 100) - parseFloat(g.getAttribute("x1") || 0);
      g.style.strokeDasharray = String(len);
      g.style.strokeDashoffset = String(len);
      setTimeout(() => { g.style.transition = "stroke-dashoffset 0.6s ease-out"; g.style.strokeDashoffset = "0"; }, i * 180);
    });
  }, { threshold: 0.2 });
  observer.observe(svg);
}