import { defineConfig } from "vitest/config";

// unit / integration は vitest(src配下)。e2e/ は Playwright が実行する。
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
