# ポジミル (pojimiru) — Phase 0A

日本語の個人裁量FXトレーダー向け「判断監査」Webアプリ。

> そのエントリー、ルール通り？
> 結果を知る前の判断だけを、あなたのプレイブックに照らして監査します。

チャート画像(エントリー時点まで)+エントリー理由を、**あなた自身のルール(プレイブック)**に照らしてAIが監査し、6分類(ルール適合/根拠不足/ルール逸脱/衝動兆候/混在/判定不能)のカルテを返します。結果(勝敗・損益)はAIに一切渡しません。将来の売買シグナル・推奨は出しません。

仕様の正本: `docs/ポジミル_機能設計書_v3.3.md` / `docs/ポジミル_Phase0_必須テスト.md` / `docs/ポジミル_ClaudeCode_着手プロンプト_v3.md`

## 技術スタック

- Next.js (App Router) / TypeScript / Tailwind CSS v4
- Anthropic API(モデルは `ANTHROPIC_MODEL` で指定、Structured Outputs + Zod 検証)
- Supabase(Anonymous Sign-In。**画像は保存しない**)
- vitest(unit / integration)+ Playwright(最小E2E)

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を記入
npm run dev
```

環境変数は `.env.example` 参照。`APP_ACCESS_COOKIE_SECRET` は十分長く(例: `openssl rand -base64 48`)。モデルIDはコードに直書きせず `ANTHROPIC_MODEL` でのみ指定します。

- `/access` … アクセスコード入力(§2.1。署名済みHttpOnly Cookieを発行)
- `/app` … メイン画面(オンボーディング→入力→AIレビュー→カルテ→結果後入力/フィードバック)

### ⚠ interim(SQL受領待ち)

`ポジミル_supabase_phase0.sql` 受領までの暫定として:

- run / karte の永続化は `InMemoryRunStore`(`src/lib/p0/store.ts`)。SQL受領後に `finalize_ai_review_run` RPC を使う Supabase service role 実装へ差し替え
- プレイブックは localStorage(`src/lib/p0/playbookLocal.ts`)。SQL受領後に Supabase(RLS)へ差し替え
- RLS 実分離テスト(RLS-001〜004, RUN-007/008)は SQL 適用済みの実 Supabase に対する gated test として追加予定

## テスト

```bash
npx tsc --noEmit   # 型チェック
npm run lint       # ESLint
npm test           # vitest(unit / integration)
npm run test:e2e   # Playwright 最小E2E(アクセス→匿名モック→クロップpixel検証→送信ガード)
```

E2E は Supabase auth と `/api/review` をネットワーク層でモックし、アクセスコード・フォーム・クロップ処理は実物を通します。

## Gate 0A 手作業記録

外部公開・Gate 0A 評価の前に、以下を実環境(実 Supabase + 実モデル)で確認して記録します:

1. **RLS A/B分離**: 匿名ユーザーA/Bを2ブラウザで作成し、互いの playbook / karte / ai_review_run が見えないこと
2. **実モデル読解品質**: 実チャート数枚で `/app` からレビューを実行し、rule_check の観察根拠が画像と対応していること
3. **再実行の検証**: カルテ表示の「同じ入力でもう一度レビューする」で run が `is_canonical=false` として追加され、karte が増えないこと(モデル比較時は `/api/review` へ `experiment_id` を付与)
4. **ブラインド確認**: 送信ペイロード・DB・ログのどこにも元画像/結果/感情が含まれないこと(自動テスト+目視)
5. **スマホタップUX**: 実機でエントリー位置タップとクロッププレビューの精度
6. **Phase 0B 未実装確認**: `/app/trends`・集計SQL・空ルートが存在しないこと(REG-005/006)

## Phase 0A で作らないもの(§16)

Stripe・OGP・Xシェア・LINE・OCR・MT4/5・TradingView・自動アラート・週次レポート・SEO CMS・画像保存・`/app/trends`・Phase 0B の空ルート。

## 規制上の制約

本ツールは投資助言業の登録を要しない設計です。将来の値動き予測、推奨エントリー/損切り/利確ゾーンの提示、具体的な売買指示は出力・表示しません。
