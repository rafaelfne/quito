import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["**/*.test.{ts,tsx,js,jsx}"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["node_modules/**", ".next/**", "coverage/**", "supabase/**", "**/*.test.{ts,tsx,js,jsx}", "**/*.d.ts", "*.config.{ts,mts,js,mjs}"],
    },
  },
});
