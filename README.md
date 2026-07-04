# TradeKarte

日本語の個人裁量FXトレーダー向け、AIトレード振り返りWebアプリ(Phase 1 MVP)。

チャート画像+一言メモを投げると、AIが「その売買の意思決定の質」を批評してカルテとして返します。数字の集計ではなく判断の質を診ます。**将来の売買シグナル・推奨は一切出しません**(過去の振り返り支援のみ)。

## 技術スタック

- Next.js (App Router) / TypeScript / Tailwind CSS
- Anthropic Claude API (`claude-sonnet-4-6`、画像入力+構造化JSON出力)
- Supabase (Postgres + Auth + Storage)
- Vercel (ホスティング) / Stripe (課金導線スタブ)

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env.local` を作成:

```bash
cp .env.example .env.local
```

- `ANTHROPIC_API_KEY` … [Anthropic Console](https://console.anthropic.com/) で発行。**これだけ設定すれば、保存なしのお試しモードで動作確認できます。**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` … Supabase プロジェクトの Settings → API から。

### 3. Supabase(認証・保存を使う場合)

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQL Editor で `supabase/migrations/0001_init.sql` を実行(karte テーブル、RLS、サムネイル用 Storage バケットが作成されます)
3. Authentication → URL Configuration で Site URL とリダイレクトURL(`http://localhost:3000/auth/callback` と本番URL)を設定
4. ログインはメールのマジックリンク方式(パスワード不要)

### 4. 起動

```bash
npm run dev
```

- `http://localhost:3000/` … ランディング
- `/app` … メイン画面(画像アップロード → AIレビュー → カルテ表示)
- `/app/history` … カルテ履歴 / `/app/karte/[id]` … 詳細

## デプロイ(Vercel)

1. リポジトリを Vercel にインポート
2. Environment Variables に `.env.local` と同じ値を設定
3. Supabase の Site URL / Redirect URL に本番ドメインを追加

## 機能メモ

- **判定は損益と独立**: エントリー時点で見えていた情報のみで「エッジ/衝動/混在」を判定。後知恵禁止をプロンプトで強制
- **パターン検出**: 直近30日で同じタグ or 「衝動」判定が3回以上繰り返されるとカルテ上に警告バナー
- **無料枠**: `/api/review` 側で月あたり `FREE_MONTHLY_LIMIT` 回(既定10回)に制限
- **コスト制御**: 画像はクライアント側で長辺1280px/JPEG q0.85 に縮小してから送信。履歴用に460pxサムネイルを別途生成し Supabase Storage(非公開バケット+署名URL)に保存
- **課金導線**: `/upgrade` はスタブ。`NEXT_PUBLIC_STRIPE_CHECKOUT_URL` を設定すると Stripe Checkout へのリンクが有効化

## 規制上の制約

本ツールは投資助言業の登録を要しない設計です。将来の値動き予測、推奨エントリー/損切り/利確ゾーンの提示、具体的な売買指示は出力・表示しません。「次の一手」は振り返りの習慣・注意点に限定しています。
