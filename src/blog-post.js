import "../src/style.css";
import { marked } from "marked";

// ── Navbar scroll ─────────────────────────────────────────────
const navbar = document.getElementById("navbar");
if (navbar) {
  const sync = () =>
    navbar.classList.toggle("nav-scrolled", window.scrollY > 20);
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

// ── marked options ────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

// ── Read slug from URL ────────────────────────────────────────
const slug = new URLSearchParams(window.location.search).get("slug");

const loading = document.getElementById("post-loading");
const wrap = document.getElementById("post-wrap");
const errEl = document.getElementById("post-error");

function showError() {
  loading?.classList.add("hidden");
  wrap?.classList.add("hidden");
  errEl?.classList.remove("hidden");
}

if (!slug) {
  showError();
} else {
  // Fetch metadata from posts.json to get title/date/tags
  Promise.all([
    fetch("/posts/posts.json").then((r) => r.json()),
    fetch(`/posts/${slug}.md`).then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.text();
    }),
  ])
    .then(([posts, markdown]) => {
      const meta = posts.find((p) => p.slug === slug);

      // Update <title> and meta
      if (meta) {
        document.getElementById("page-title").textContent =
          `${meta.title} — Tri Adi`;
        document
          .getElementById("page-desc")
          .setAttribute("content", meta.excerpt);
        document.getElementById("post-title").textContent = meta.title;
        document.getElementById("post-date").textContent = meta.date;
        document.getElementById("post-tags").innerHTML = meta.tags
          .map(
            (t) =>
              `<span class="blog-tag text-[0.72rem] px-3 py-1">${t}</span>`,
          )
          .join("");
      }

      // Estimate reading time (~200 wpm)
      const words = markdown.split(/\s+/).length;
      const mins = Math.max(1, Math.round(words / 200));
      const readEl = document.getElementById("post-read");
      if (readEl) readEl.textContent = `${mins} min read`;

      // Render markdown
      document.getElementById("post-body").innerHTML = marked.parse(markdown);

      // Show content
      loading?.classList.add("hidden");
      wrap?.classList.remove("hidden");

      // Smooth scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });
    })
    .catch(showError);
}
