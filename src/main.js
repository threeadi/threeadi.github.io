import "./style.css";

document.addEventListener("DOMContentLoaded", () => {
  // ── Hero flashlight ───────────────────────────────────────────
  const hero = document.getElementById("hero");
  if (hero) {
    let raf = false;
    hero.addEventListener("mousemove", (e) => {
      if (raf) return;
      raf = true;
      requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
        hero.style.setProperty("--my", `${e.clientY - r.top}px`);
        raf = false;
      });
    });
    hero.addEventListener("mouseleave", () => {
      hero.style.setProperty("--mx", "-9999px");
      hero.style.setProperty("--my", "-9999px");
    });
    hero.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches[0];
        const r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", `${t.clientX - r.left}px`);
        hero.style.setProperty("--my", `${t.clientY - r.top}px`);
      },
      { passive: true },
    );
  }

  // ── Navbar scroll glass ───────────────────────────────────────
  const navbar = document.getElementById("navbar");
  if (navbar) {
    const sync = () =>
      navbar.classList.toggle("nav-scrolled", window.scrollY > 20);
    window.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  // ── Hamburger / mobile menu ───────────────────────────────────
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobile-menu");
  if (hamburger && mobileMenu) {
    const openMenu = () => {
      hamburger.classList.add("open");
      hamburger.setAttribute("aria-expanded", "true");
      mobileMenu.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    const closeMenu = () => {
      hamburger.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
      mobileMenu.classList.remove("open");
      document.body.style.overflow = "";
    };
    hamburger.addEventListener("click", () =>
      mobileMenu.classList.contains("open") ? closeMenu() : openMenu(),
    );
    document
      .querySelectorAll(".mobile-link")
      .forEach((l) => l.addEventListener("click", closeMenu));
    document.addEventListener("click", (e) => {
      if (
        mobileMenu.classList.contains("open") &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      )
        closeMenu();
    });
  }

  // ── Smooth scroll with navbar offset ─────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({
        top: target.offsetTop - (navbar?.offsetHeight ?? 68) - 16,
        behavior: "smooth",
      });
    });
  });

  // ── Scroll-reveal (IntersectionObserver) ─────────────────────
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
