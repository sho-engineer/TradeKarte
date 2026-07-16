import { defineConfig } from "@playwright/test";

// 最小E2E(必須テスト16章)。Supabase auth と /api/review はルート
// インターセプトでモックし、アクセスコード・フォーム・クロップは実物を通す。
// 実行環境にプリインストールされた chromium を使用する。

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? { executablePath: "/opt/pw-browsers/chromium" }
      : undefined,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/access`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_ACCESS_CODE: "e2e-access-code",
      APP_ACCESS_COOKIE_SECRET:
        "e2e-secret-0123456789-0123456789-0123456789-0123456789",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase-e2e.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      // /api/review は E2E ではインターセプトされるが、503分岐を避けるため設定
      ANTHROPIC_API_KEY: "e2e-not-used",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-not-used",
    },
  },
});
