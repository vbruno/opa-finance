import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    sequence: {
      concurrent: false, // não roda testes em paralelo
      shuffle: false,
    },

    // 🚫 DESATIVAR isolamento é ESSENCIAL para Fastify + Postgres + JWT
    isolate: false,

    globals: true,
    reporters: "verbose",
    environment: "node",

    setupFiles: [],

    coverage: {
      reporter: ["text", "html"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
