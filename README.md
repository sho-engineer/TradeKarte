# ポジミル (pojimiru)

日本語の個人裁量FXトレーダー向け、AIトレード振り返りWebアプリ(Phase 1 MVP)。
「そのポジは、エッジか衝動か。」

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
- `MOCK_REVIEW=1` … APIキー無しで固定レビューを返す開発/デモ用モード。UIフローの確認やコスト節約に。**本番では設定しないこと**(設定すると常に固定レビューになります)。
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` … Supabase プロジェクトの Settings → API から。
- `NEXT_PUBLIC_SITE_URL` … 本番URL(OGP画像・シェアリンクの絶対URL生成に使用)。未設定時は `http://localhost:3000`。本番では必ず設定します。

### 3. Supabase(認証・保存を使う場合)

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQL Editor で `supabase/migrations/` の SQL を番号順に実行(0001: karte テーブル・RLS・Storage バケット / 0002: 機能設計書v2 対応の列と pattern_alert テーブル)
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

Next.js プロジェクトは Vercel がゼロコンフィグで検出します(`vercel.json` 不要)。

1. [vercel.com/new](https://vercel.com/new) でこのリポジトリを import(Framework は Next.js を自動検出)
2. Production Branch を `main` に(main へマージ済みであること)
3. Environment Variables を設定:

   | 変数 | 必須 | 備考 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | ✅ | サーバー専用。クライアントに露出させない |
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 同上 |
   | `NEXT_PUBLIC_SITE_URL` | ✅ | 本番URL。未設定だと OGP画像URLが localhost になる |
   | `FREE_MONTHLY_LIMIT` | 任意 | 省略時 5 |
   | `NEXT_PUBLIC_STRIPE_CHECKOUT_URL` | 任意 | 課金導線を有効化するとき |
   | `MOCK_REVIEW` | 本番不可 | 設定すると常に固定レビューになる。本番では未設定 |

4. Deploy。初回デプロイ後、払い出された本番URLを `NEXT_PUBLIC_SITE_URL` に設定して再デプロイ(OGP/シェアの絶対URLを確定させる)
5. Supabase の Authentication → URL Configuration に、本番URLと `<本番URL>/auth/callback` を追加。Storage バケット `karte-thumbs` と migrations(0001/0002)が適用済みであることを確認

> まずは `ANTHROPIC_API_KEY` だけでお試しモードとして動作確認し、その後 Supabase 系の変数を追加する段階投入も可能です。

## 機能メモ

- **判定は損益と独立**: エントリー時点で見えていた情報のみで「エッジ/衝動/混在」を判定。後知恵禁止をプロンプトで強制。pnl系の値がプロンプトに混入しないことは `npm test`(vitest)で担保
- **感情セルフタグ(F1)**: エントリー前の感情を1タップで自己申告(任意)。AIが実際の行動との乖離を判定し、ズレがあればカルテに「自己認識とズレ」バッジ+criticで指摘
- **パターン検出**: 直近30日で同じタグ / 「衝動」判定 / 自己認識のズレが3回以上繰り返されるとカルテ上に警告バナー
- **無料枠**: `/api/review` 側で月あたり `FREE_MONTHLY_LIMIT` 回(既定5回)に制限。加えて短時間の連打はperユーザーのバースト制限(既定: 1分5回)で保護
- **コスト制御**: 画像はクライアント側で長辺1280px/JPEG q0.85 に縮小してから送信。履歴用に460pxサムネイルを別途生成し Supabase Storage(非公開バケット+署名URL)に保存
- **課金導線**: `/upgrade` はスタブ。`NEXT_PUBLIC_STRIPE_CHECKOUT_URL` を設定すると Stripe Checkout へのリンクが有効化
- **将来機能**: `docs/feature-design-v2.md` 参照。F2 約定履歴スクショ読み取り(`/api/extract`)・F3 Ask Karte(`/api/ask`)・F4 行動連鎖パターン検出(`/api/patterns/scan`)はエンドポイントのみ切ってあり、現状 501 を返す。スキーマ(列・pattern_alert)は 0002 で対応済み

## 規制上の制約

本ツールは投資助言業の登録を要しない設計です。将来の値動き予測、推奨エントリー/損切り/利確ゾーンの提示、具体的な売買指示は出力・表示しません。「次の一手」は振り返りの習慣・注意点に限定しています。
