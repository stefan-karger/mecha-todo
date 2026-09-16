import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: ".playwright",
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        db: entry("./src/persistence/db.ts"),
        repository: entry("./src/persistence/repository.ts"),
        validation: entry("./src/persistence/validation.ts"),
        startup: entry("./src/persistence/startup.ts"),
        "delete-undo": entry("./src/app/delete-undo.ts"),
        ranks: entry("./src/domain/ranks.ts"),
        "mount-app": entry("./tests/fixtures/mount-app.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  preview: {
    cors: true,
  },
});
