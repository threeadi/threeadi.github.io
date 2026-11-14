import "./style.css";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

const slug = document.body.dataset.slug;
const wrap = document.getElementById("post-wrap");
const body = document.getElementById("post-body");
const error = document.getElementById("post-error");

function showError() {
  wrap?.classList.add("hidden");
  error?.classList.remove("hidden");
}

if (!slug) {
  showError();
} else {
  fetch(`/posts/${slug}.md`)
    .then((response) => {
      if (!response.ok) throw new Error("Article not found");
      return response.text();
    })
    .then((markdown) => {
      const words = markdown.trim().split(/\s+/).length;
      const minutes = Math.max(1, Math.round(words / 200));
      const readingTime = document.getElementById("post-read");
      if (readingTime) readingTime.textContent = `${minutes} min read`;

      const articleMarkdown = markdown.replace(/^#\s+.*\r?\n+/, "");
      body.innerHTML = marked.parse(articleMarkdown);
    })
    .catch(showError);
}
