import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        blogIndex: resolve(__dirname, "blog/index.html"),
        blogPost: resolve(__dirname, "blog/post.html"),
        promotionEngine: resolve(
          __dirname,
          "blog/promotion-engine/index.html",
        ),
        warehouseRouting: resolve(
          __dirname,
          "blog/warehouse-routing/index.html",
        ),
        apiPerformance: resolve(
          __dirname,
          "blog/api-performance/index.html",
        ),
      },
    },
  },
});
