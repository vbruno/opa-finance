import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * 🔒 Execução totalmente sequencial
     * Necessário para DB remoto compartilhado
     */
    sequence: {
      concurrent: false,
      shuffle: false,
    },

    /**
     * ⏱️ Tempo alto por causa de:
     * - PostgreSQL remoto
     * - autenticação
     * - seeds
     */
    testTimeout: 20000,
    hookTimeout: 20000,

    /**
     * 🧵 Forks é mais estável que threads
     * para integração com DB real
     */
    pool: "forks",

    /**
     * 🚫 Nunca rodar testes em paralelo
     */
    maxConcurrency: 1,

    /**
     * ⚠️ Compartilha estado entre testes
     * Usado propositalmente por causa do DB
     * NÃO ativar concorrência com isso ligado
     */
    isolate: false,

    globals: true,
    reporters: "verbose",
    environment: "node",

    /**
     * Se no futuro precisar:
     * setupFiles: ["./test/setup.ts"],
     */
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
