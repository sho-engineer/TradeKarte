import { expect, test, type Page } from "@playwright/test";
import { makeValidReview } from "../src/lib/p0/__tests__/fixtures";

// 必須E2E(必須テスト「外部公開前の合格条件」):
// アクセスコード → 匿名サインイン(モック) → オンボーディング →
// 必須項目バリデーション → タップ → クロッププレビュー(幅・右端teal線を
// pixel検証) → 確認チェックなしでは送信不可 → モックAIでカルテ表示。

const ACCESS_CODE = "e2e-access-code";

function b64url(s: string): string {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const FAKE_JWT = [
  b64url('{"alg":"HS256","typ":"JWT"}'),
  b64url(
    '{"sub":"e2e-user-1","role":"authenticated","aud":"authenticated","exp":9999999999}',
  ),
  "c2ln",
].join(".");

const FAKE_USER = {
  id: "e2e-user-1",
  aud: "authenticated",
  role: "authenticated",
  email: "",
  phone: "",
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: "2026-07-01T00:00:00.000Z",
  is_anonymous: true,
};

const FAKE_SESSION = {
  access_token: FAKE_JWT,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "e2e-refresh",
  user: FAKE_USER,
};

/** Supabase auth(匿名サインイン)をネットワーク層でモックする */
async function mockSupabaseAuth(page: Page) {
  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: FAKE_SESSION });
    } else {
      await route.fulfill({ json: { user: FAKE_USER } });
    }
  });
}

/** ページ内Canvasで単色PNG(400x200)を生成して file input へ渡す */
async function uploadChart(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1c2530";
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = "#c0c8d0";
    for (let x = 10; x < 400; x += 20) ctx.fillRect(x, 40, 8, 120);
    return canvas.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "chart.png", mimeType: "image/png", buffer });
}

async function enterApp(page: Page) {
  await mockSupabaseAuth(page);
  await page.goto("/access");
  await page.getByPlaceholder("アクセスコード").fill(ACCESS_CODE);
  await page.getByRole("button", { name: "入室する" }).click();
  await page.waitForURL("**/app");
}

async function createPlaybook(page: Page) {
  await expect(
    page.getByRole("heading", { name: "はじめに: 自分ルールの登録" }),
  ).toBeVisible();
  await page.getByPlaceholder("例: 押し目買い").fill("押し目買い");
  await page
    .getByPlaceholder("必須条件 1(例: 上位足が上昇トレンド)")
    .fill("上位足が上昇トレンド");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("1. 取引日時")).toBeVisible();
}

test("ACCESS: /app はコードなしで /access へ、誤コードは拒否", async ({
  page,
}) => {
  await page.goto("/app");
  await page.waitForURL("**/access");

  await page.getByPlaceholder("アクセスコード").fill("wrong-code");
  await page.getByRole("button", { name: "入室する" }).click();
  await expect(page.getByText("アクセスコードが違います。")).toBeVisible();
  expect(page.url()).toContain("/access");
});

test("入力〜クロップ〜送信の必須フロー", async ({ page }) => {
  await enterApp(page);
  await createPlaybook(page);

  // FORM-001: 必須項目が欠けたままでは実行できない(画像未指定)
  await page.getByRole("button", { name: "AIレビューを実行" }).click();
  await expect(
    page.getByText("チャート画像を選択し、エントリー位置をタップしてください"),
  ).toBeVisible();

  // IMG-004: 画像選択後もタップ前はクロップが存在しない
  await uploadChart(page);
  await expect(
    page.getByText("エントリーしたローソク足の右端をタップしてください", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("クロップ後プレビュー")).toHaveCount(0);
  await page.getByRole("button", { name: "AIレビューを実行" }).click();
  await expect(
    page.getByText("チャート画像を選択し、エントリー位置をタップしてください"),
  ).toBeVisible();

  // 幅の60%をタップ → cutX = max(40, round(400*0.6)) = 240
  const img = page.getByAltText("チャート画像(タップでエントリー位置を指定)");
  const box = (await img.boundingBox())!;
  await img.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
  await expect(page.getByText("クロップ後プレビュー")).toBeVisible();

  // IMG-005/006/007: プレビューの実寸と右端teal線をpixel検証
  const pixelCheck = await page.evaluate(async () => {
    const el = document.querySelector(
      'img[alt="クロップ後のチャート画像"]',
    ) as HTMLImageElement;
    if (!el) return null;
    await new Promise<void>((resolve) => {
      if (el.complete) resolve();
      else el.onload = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(el, 0, 0);
    const right = ctx.getImageData(el.naturalWidth - 2, 100, 1, 1).data;
    const inner = ctx.getImageData(el.naturalWidth - 10, 100, 1, 1).data;
    return {
      width: el.naturalWidth,
      height: el.naturalHeight,
      right: [right[0], right[1], right[2]],
      inner: [inner[0], inner[1], inner[2]],
    };
  });
  expect(pixelCheck).not.toBeNull();
  // クロップ幅 = cutX(マージンなし)
  expect(pixelCheck!.width).toBe(240);
  expect(pixelCheck!.height).toBe(200);
  // 右端は #5EA8B3(JPEG劣化を考慮して±12許容)
  const [r, g, b] = pixelCheck!.right;
  expect(Math.abs(r - 0x5e)).toBeLessThanOrEqual(12);
  expect(Math.abs(g - 0xa8)).toBeLessThanOrEqual(12);
  expect(Math.abs(b - 0xb3)).toBeLessThanOrEqual(12);
  // 線のすぐ内側はチャート地(tealではない)
  expect(Math.abs(pixelCheck!.inner[1] - 0xa8)).toBeGreaterThan(30);

  // 残りの必須項目を埋める(確認チェックはまだ)
  await page.getByPlaceholder("例: USD/JPY").fill("USD/JPY");
  await page.getByRole("button", { name: "ロング(買い)" }).click();
  await page
    .getByPlaceholder(
      "なぜこのタイミングでエントリーしたのかを、当時の判断として書いてください",
    )
    .fill("サポートで反発を確認したため");
  await page.getByRole("button", { name: "当時記録していた" }).click();

  // IMG-008: 確認チェックなしでは送信不可
  await page.getByRole("button", { name: "AIレビューを実行" }).click();
  await expect(
    page.getByText("クロップ後画像の確認チェックが必要です"),
  ).toBeVisible();

  // /api/review をモックして成功フロー(カルテ表示)を確認
  let reviewPayload: Record<string, unknown> | null = null;
  await page.route("**/api/review", async (route) => {
    reviewPayload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        karte_id: "karte-e2e-1",
        run_id: "run-e2e-1",
        is_canonical: true,
        blind_integrity: "clean",
        review: makeValidReview(),
      },
    });
  });
  await page
    .getByText(
      "この画像に、損益・決済結果・エントリー後の情報が含まれていないことを確認しました。",
    )
    .click();
  await page.getByRole("button", { name: "AIレビューを実行" }).click();

  // カルテUI(§11)の見出しと6分類表示
  await expect(page.getByText("判断監査", { exact: true })).toBeVisible();
  await expect(page.getByText("ルール適合")).toBeVisible();
  for (const title of [
    "確認できた事実",
    "ルール照合",
    "矛盾・行動兆候",
    "不足情報",
    "振り返りの問い",
    "自己申告感情と行動兆候",
    "結果を含む振り返り",
    "フィードバック",
  ]) {
    await expect(
      page.getByRole("heading", { name: title, exact: false }),
    ).toBeVisible();
  }

  // 送信ペイロードの検証: クロップ済みJPEGのみ・確認済み・結果語なし
  expect(reviewPayload).not.toBeNull();
  const p = reviewPayload!;
  expect(String(p.image)).toMatch(/^data:image\/jpeg;base64,/);
  expect(p.image_blind_confirmed).toBe(true);
  expect(p.result_word_detected).toBe(false);
  expect(p.result_warning_overridden).toBe(false);
  expect(p.trade_timezone).toBeTruthy();
  expect(p).not.toHaveProperty("result");
  expect(p).not.toHaveProperty("user_id");

  // RESULT系UI: 結果の後入力(モック)
  await page.route("**/api/karte/karte-e2e-1/result", async (route) => {
    await route.fulfill({
      json: { karte_id: "karte-e2e-1", result: route.request().postDataJSON() },
    });
  });
  await page.getByRole("button", { name: "勝ち" }).click();
  await page.getByRole("button", { name: "結果を保存" }).click();
  await expect(page.getByText("結果を保存しました", { exact: false })).toBeVisible();
});

test("結果語検出: 確認ダイアログ→続行で override が記録される", async ({
  page,
}) => {
  await enterApp(page);
  await createPlaybook(page);

  await uploadChart(page);
  const img = page.getByAltText("チャート画像(タップでエントリー位置を指定)");
  const box = (await img.boundingBox())!;
  await img.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page
    .getByText(
      "この画像に、損益・決済結果・エントリー後の情報が含まれていないことを確認しました。",
    )
    .click();

  await page.getByPlaceholder("例: USD/JPY").fill("USD/JPY");
  await page.getByRole("button", { name: "ショート(売り)" }).click();
  await page
    .getByPlaceholder(
      "なぜこのタイミングでエントリーしたのかを、当時の判断として書いてください",
    )
    .fill("戻り売り。結果的に利確できたので正しかったと思う");
  await page.getByRole("button", { name: "記憶から入力した" }).click();

  let reviewPayload: Record<string, unknown> | null = null;
  await page.route("**/api/review", async (route) => {
    reviewPayload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        karte_id: "karte-e2e-2",
        run_id: "run-e2e-2",
        is_canonical: true,
        blind_integrity: "warning_overridden",
        review: makeValidReview(),
      },
    });
  });

  // FORM-008: 検出→ダイアログ→続行(自動削除されない)
  await page.getByRole("button", { name: "AIレビューを実行" }).click();
  await expect(
    page.getByText("結果語が含まれている可能性"),
  ).toBeVisible();
  await page.getByRole("button", { name: "このまま続行" }).click();

  await expect(page.getByText("判断監査", { exact: true })).toBeVisible();
  expect(reviewPayload).not.toBeNull();
  expect(reviewPayload!.result_word_detected).toBe(true);
  expect(reviewPayload!.result_warning_overridden).toBe(true);
  expect(String(reviewPayload!.entry_reason)).toContain("結果的に");
});
