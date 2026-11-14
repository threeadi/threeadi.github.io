import "./style.css";

const grid = document.getElementById("posts-grid");
const searchInput = document.getElementById("search");
const filterContainer = document.getElementById("tag-filters");

let posts = [];
let activeTag = "";
let searchTerm = "";

function renderPosts() {
  const filtered = posts.filter((post) => {
    const haystack = `${post.title} ${post.excerpt} ${post.tags.join(" ")}`.toLowerCase();
    return (!searchTerm || haystack.includes(searchTerm)) &&
      (!activeTag || post.tags.includes(activeTag));
  });

  if (!filtered.length) {
    grid.innerHTML =
      '<p class="writing-status">No articles match that search. Try another topic.</p>';
    return;
  }

  grid.innerHTML = filtered
    .map(
      (post) => `
        <article class="writing-item">
          <a href="/blog/${post.slug}/" aria-label="Read ${post.title}">
            <div class="writing-item-meta">
              <time datetime="${post.dateISO}">${post.date}</time>
              <span>${post.tags.join(" · ")}</span>
            </div>
            <div class="writing-item-copy">
              <h2>${post.title}</h2>
              <p>${post.excerpt}</p>
            </div>
            <span class="writing-item-arrow" aria-hidden="true">↗</span>
          </a>
        </article>
      `,
    )
    .join("");
}

function renderFilters() {
  const tags = [...new Set(posts.flatMap((post) => post.tags))].sort();
  filterContainer.innerHTML = ["", ...tags]
    .map((tag) => {
      const label = tag || "All";
      const pressed = tag === activeTag;
      return `<button type="button" data-tag="${tag}" aria-pressed="${pressed}">${label}</button>`;
    })
    .join("");

  filterContainer.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeTag = button.dataset.tag;
      renderFilters();
      renderPosts();
    });
  });
}

fetch("/posts/posts.json")
  .then((response) => {
    if (!response.ok) throw new Error("Could not load posts");
    return response.json();
  })
  .then((data) => {
    posts = data;
    renderFilters();
    renderPosts();
  })
  .catch(() => {
    grid.innerHTML =
      '<p class="writing-status">Articles could not be loaded. Please refresh the page.</p>';
  });

searchInput?.addEventListener("input", (event) => {
  searchTerm = event.target.value.toLowerCase().trim();
  renderPosts();
});
