import "../src/style.css";

const navbar = document.getElementById("navbar");
if (navbar) {
  const sync = () =>
    navbar.classList.toggle("nav-scrolled", window.scrollY > 20);
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

async function renderPosts(filter = "", activeTag = "") {
  const res = await fetch("/posts/posts.json");
  const all = await res.json();

  const filtered = all.filter((p) => {
    const matchText =
      !filter ||
      p.title.toLowerCase().includes(filter) ||
      p.excerpt.toLowerCase().includes(filter);
    const matchTag = !activeTag || p.tags.includes(activeTag);
    return matchText && matchTag;
  });

  const grid = document.getElementById("posts-grid");

  if (!filtered.length) {
    grid.innerHTML =
      '<div class="col-span-full text-center font-mono text-sm text-t3 py-12">No posts found.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p, i) => `
    <article class="reveal card p-6 flex flex-col gap-3 hover:shadow-[0_8px_28px_rgba(0,0,0,0.28)] hover:-translate-y-1 transition-all" style="transition-delay:${i * 70}ms">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <time class="font-mono text-[0.68rem] text-t3">${p.date}</time>
        <div class="flex gap-1.5 flex-wrap">${p.tags.map((t) => `<span class="blog-tag cursor-pointer" data-tag="${t}">${t}</span>`).join("")}</div>
      </div>
      <h2 class="text-[0.97rem] font-semibold text-t1 leading-snug">${p.title}</h2>
      <p class="text-[0.85rem] text-t2 leading-[1.7] flex-1">${p.excerpt}</p>
      <a href="/blog/post.html?slug=${p.slug}" class="font-mono text-[0.78rem] text-accent mt-auto hover:text-accent-hi hover:tracking-wide transition-all">Read more →</a>
    </article>
  `,
    )
    .join("");

  // Reveal animation
  const obs = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      }),
    { threshold: 0.08 },
  );
  document
    .querySelectorAll("#posts-grid .reveal")
    .forEach((el) => obs.observe(el));

  // Tag click inside cards
  document.querySelectorAll("#posts-grid [data-tag]").forEach((el) => {
    el.addEventListener("click", () => {
      const tag = el.dataset.tag;
      setActiveTag(tag === activeTag ? "" : tag);
    });
  });
}

function buildTagFilters(tags, activeTag) {
  const container = document.getElementById("tag-filters");
  container.innerHTML = ["all", ...tags]
    .map(
      (t) => `
    <button data-tag="${t === "all" ? "" : t}"
      class="font-mono text-[0.7rem] px-3 py-1 rounded-full border transition-all duration-150 cursor-pointer
      ${
        (!activeTag && t === "all") || activeTag === t
          ? "text-accent border-accent bg-accent/10"
          : "text-t3 border-line hover:text-t2 hover:border-line-hi"
      }">
      ${t}
    </button>
  `,
    )
    .join("");
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTag(btn.dataset.tag));
  });
}

let currentTag = "";
let currentSearch = "";

function setActiveTag(tag) {
  currentTag = tag;
  buildTagFilters(allTags, currentTag);
  renderPosts(currentSearch, currentTag);
}

let allTags = [];

fetch("/posts/posts.json")
  .then((r) => r.json())
  .then((posts) => {
    allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();
    buildTagFilters(allTags, "");
    renderPosts();
  })
  .catch(() => {
    document.getElementById("posts-grid").innerHTML =
      '<div class="col-span-full text-center font-mono text-sm text-t3 py-12">Could not load posts.</div>';
  });

const searchInput = document.getElementById("search");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    renderPosts(currentSearch, currentTag);
  });
}
