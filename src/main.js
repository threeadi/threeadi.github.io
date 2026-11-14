import "./style.css";

document.addEventListener("DOMContentLoaded", () => {
  const obs = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      }),
    { threshold: 0.1, rootMargin: "0px 0px -28px 0px" },
  );
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));

  // ── Stagger blog preview cards ────────────────────────────────
  document.querySelectorAll(".blog-stagger").forEach((c, i) => {
    c.style.transitionDelay = `${i * 90}ms`;
  });
});
