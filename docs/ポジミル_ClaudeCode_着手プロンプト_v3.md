# ポジミル — Claude Code 着手プロンプト v3

**同期版リビジョン**：v3.1
**最終更新**：2026-07-15
**今回の実装範囲**：Phase 0Aのみ

Claude Codeへ渡す4点セット：

1. `docs/ポジミル_ClaudeCode_着手プロンプト_v3.md`
2. `docs/ポジミル_機能設計書_v3.3.md`
3. `docs/ポジミル_supabase_phase0.sql`
4. `docs/ポジミル_Phase0_必須テスト.md`

仕様の優先順位：

1. 詳細挙動・AI文言：機能設計書v3.3
2. DB列名・制約・RLS：SQL
3. 必須テスト：テスト文書
4. 実装手順：本書

食い違いを見つけた場合、推測で実装せず、着手前のブロッカーとして報告してください。

---

## 最初に必ず行うこと

4ファイルをすべて読み終えた後、**コードを書かずに**次を提示してください。

1. 現在のリポジトリ構成
2. 既存React/ViteモックまたはNext.jsコードの扱い
3. Phase 0Aステップ1〜17の実装計画
4. ステップ1〜10の詳細な作業順
5. 必要な環境変数
6. 翔が行う手動セットアップ
7. 既存コードへ影響する範囲
8. 仕様上の矛盾・ブロッカー
9. 使用予定のAnthropic SDKバージョンと、公式確認したモデルID・Structured Outputs API形
10. テスト戦略

提示後、翔のOKを待ってください。OK前にコードを書かないでください。

---

## プロジェクト概要

**ポジミル**（pojimiru.com）は、日本語の個人裁量FXトレーダー向けAIトレード振り返りアプリです。

- 問い：そのポジは、エッジか衝動か。
- 宣言：**AIは、結果を知らない。**
- 体験：勝ったのに、怒られる。

AIが見るのは、エントリー地点までの画像、本人の事前登録ルール、エントリー理由です。

### 不変条項

- 将来の売買シグナル、推奨、価格予測を出さない
- 結果、pips、決済理由、感情を初回AIへ渡さない
- エントリー後のチャートを渡さない
- 単発トレードから「エッジ」を断定しない
- ユーザーが申告していないルールを追加しない
- AI判定を絶対視せずユーザー訂正を保存する

---

## 今回実装するもの：Phase 0A

1. Next.js App Router基盤
2. アクセスコード
3. Supabase Anonymous Sign-In
4. RLS
5. プレイブック登録・選択・バージョン管理
6. karte
7. ai_review_run
8. `/api/review`
9. Structured Outputs＋Zod
10. 結果・感情非送信テスト
11. クロップ生成テスト
12. 入力画面
13. カルテ表示
14. 結果後入力
15. 構造化フィードバック
16. revision_of
17. 自分10〜15件の検証を行える状態

## 今回は実装しないもの：Phase 0B

- `/app/trends`
- 傾向ビュー
- 集計SQL
- 自動アラート
- 通知
- 外部テスター向け追加機能
- 空ルート
- 空コンポーネント

0B着手条件を満たすまで、一切作成しないでください。

---

## 技術スタック

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Supabase Anonymous Sign-In
- PostgreSQL RLS
- Anthropic TypeScript SDK
- Anthropic Structured Outputs
- Zod
- VitestまたはJest
- Playwright（必要なE2Eのみ）

既存リポジトリがReact/Viteモックだけの場合：

- 既存モックを削除しない
- 破壊的に置き換えない
- 新しいNext.jsアプリの配置場所を提案
- 承認後に作成

---

## 必要な環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5

APP_ACCESS_CODE=
APP_ACCESS_COOKIE_SECRET=
```

ルール：

- `SUPABASE_SERVICE_ROLE_KEY`はサーバーのみ
- `ANTHROPIC_API_KEY`はサーバーのみ
- `APP_ACCESS_CODE`と`APP_ACCESS_COOKIE_SECRET`はサーバーのみ
- `.env.example`を作る
- 実値をコミットしない
- モデルIDをコードへ直書きしない

---

## 翔が事前に行う手動セットアップ

1. Supabaseプロジェクトを作成
2. AuthenticationでAnonymous Sign-Inを有効化
3. SQL Editorで`ポジミル_supabase_phase0.sql`をそのまま実行
4. Anthropic APIキーを用意
5. Anthropic公式Models APIまたは公式ドキュメントで`ANTHROPIC_MODEL`が利用可能か確認
6. 環境変数を設定
7. 十分に長い`APP_ACCESS_COOKIE_SECRET`を生成
8. Phase 0AではSupabase Storage bucketを作らない
9. 本番URLでSecure Cookieを確認

---

## Anthropic実装ルール

### モデル

2026-07-15時点のデフォルト：

```env
ANTHROPIC_MODEL=claude-sonnet-5
```

比較候補：

- `claude-sonnet-4-6`
- `claude-opus-4-8`

実装時に公式Models APIまたは公式ドキュメントで再確認してください。

### Structured Outputs

現行形を使います。

```ts
output_config: {
  format: {
    type: "json_schema",
    schema: reviewJsonSchema
  }
}
```

- 旧`output_format`を直接API payloadへ使わない
- 旧beta headerを前提にしない
- Structured Outputsの後にZod検証を行う
- `stop_reason=refusal`と`stop_reason=max_tokens`を失敗として扱う

---

## AIレビューの絶対ルール

- System Promptは機能設計書v3.3の7章を一字一句使用
- JSON Schemaは機能設計書v3.3の8章と一致
- `rule_check`は以下を必須とする
  - `rule_id`
  - `rule_type`
  - `rule_text`
  - `observation`
  - `adherence`
  - `reason`
- required：
  - met → compliant
  - not_met → violated
- avoid：
  - met → violated
  - not_met → compliant
- invalidation：
  - met → violated
  - not_met → compliant
- unknown → unknown
- AIへ渡した条件と、返却されたrule_id・rule_type・rule_textが完全一致しなければ失敗
- 結果、pips、決済理由、感情をリクエストDTOへ定義しない
- 元画像をAPIへ送らない
- base64やリクエスト本文をログへ出さない
- パース・Zod・rule mapping失敗時はカルテを保存しない

---

## AI実行と保存フロー

1. アクセスコードCookie検証
2. Supabaseセッション確認
3. リクエストDTO検証
4. `ai_review_run`を`running`、`karte_id=null`で作成
5. Anthropic API実行
6. HTTP、stop_reason、Structured Outputs、Zod、rule mapping検証
7. 失敗：
   - runを`failed`へ更新
   - karteを作らない
8. 初回成功：
   - SQLの`finalize_ai_review_run` RPCを呼ぶ
   - karte作成とrun確定を同一トランザクションで行う
   - `is_canonical=true`
9. 同一入力の再実行・モデル比較：
   - 新しいkarteを作らない
   - 既存karteへrunを関連付ける
   - `is_canonical=false`

同一karteにcanonical runは1件だけです。

---

## 実装順：Phase 0A

### Step 1：基盤とアクセスコード

- Next.js App Router
- TypeScript
- Tailwind
- ESLint
- `.env.example`
- デザイントークン
- 反射ローソク足SVG
- `/api/access`
- 署名済みHttpOnly Cookie
- `/app`保護

### Step 2：Supabase Anonymous Sign-In

- ブラウザクライアント
- サーバークライアント
- 匿名サインイン
- セッション復元
- 匿名認証の注意文
- `user_id`を本文から受け取らない

### Step 3：RLS

- SQL適用前提
- ユーザーA/B分離テスト
- `playbook`はクライアントから自分の行をselect / insert可能。既存版のupdate / deleteは禁止
- `karte`の直接insert / update / deleteは禁止。結果・feedback・revisionもサーバーRoute Handler経由
- `ai_review_run`書き込みはservice roleだけ
- クライアントは自分のkarteとrunをselect可能

### Step 4：プレイブック

- 最低1個必須
- 2〜3個推奨
- required最大3
- avoid最大2
- invalidation最大1
- rule_id付与
- 1行1条件
- 編集は新バージョン
- 既存上書き禁止
- スナップショット

### Step 5：karte

- trade_at
- trade_timezone
- blind integrity 4項目
- 英語内部enum
- AI出力
- 結果後入力
- feedback
- revision_of
- 画像列なし
- AI実行メタなし

### Step 6：ai_review_run

- 成功・失敗・running
- failure_stage
- canonical
- experiment_id
- parsed_response
- raw_response
- token・latency・cost
- unique canonical index

### Step 7：`/api/review`

- 認証ユーザーだけ
- アクセスコード必須
- レート制限
- クロップ済み画像だけ
- 結果・感情フィールドなし
- run作成
- Anthropic呼び出し
- RPC確定

### Step 8：Structured Outputs＋Zod

- 現行`output_config.format`
- JSON Schema
- Zod
- exact rule set検証
- avoid評価反転検証
- stop_reason検証
- reflection question検証

### Step 9：核心テスト1

自動テスト必須：

- `result`がAIリクエストにない
- `pnl_pips`がない
- `exit_reason`がない
- `emotion_pre`がない
- プロンプト本文にも値が混入しない
- user_idを本文から使わない

### Step 10：核心テスト2

自動テスト必須：

- 長辺1280px
- JPEG 0.85
- マージンなし
- タップ位置より右がない
- 右端に#5EA8B3の3px線
- 未指定では実行不可
- 確認チェックなしでは実行不可
- 画像非保存

### Step 11：入力画面

- trade_at
- trade_timezone
- 画像
- タップ位置
- クロップ後プレビュー
- ブラインド確認
- pair
- direction
- playbook
- entry_reason
- 結果語警告
- emotion_pre
- memory_source

### Step 12：オンボーディングとプレイブックUI

- 0件時は登録必須
- 入力画面から新規作成
- 選択
- 新バージョン
- 作成・編集フラグ

### Step 13：カルテ表示

- 6分類
- rule_typeを考慮した照合表示
- 観察と遵守を分ける
- 感情と行動兆候を並列表示
- 同一入力の再実行導線
- 画像再表示なし

### Step 14：結果後入力

- サーバーRoute Handler経由
- セッションから所有者確認
- win / loss / breakeven
- pips
- exit_reason
- AI再実行なし
- assessment変更なし

### Step 15：構造化フィードバック

- サーバーRoute Handler経由
- セッションから所有者確認
- helpful / partial / not_helpful
- incorrect_area[]
- corrected_assessment
- comment

### Step 16：revision_of

- 入力訂正のみ
- 元カルテ不変
- 新カルテ作成
- 結果入力では作らない

### Step 17：検証可能な状態

- 自分の取引10〜15件
- 同一入力再実行
- 非canonical比較run
- Gate 0A記録を手作業で行える
- Phase 0B未実装

---

## Phase 0Aで作らないもの

機能設計書v3.3の16章を厳守してください。

特に：

- `/app/trends`
- 集計SQL
- MT4 / MT5
- TradingView
- Stripe
- OGP
- Xシェア
- 週次レポート
- 自動アラート
- 画像保存
- 将来機能の空ルート

---

## 完了条件

- アクセスコードが`/app`と`/api/review`で有効
- Anonymous Sign-Inが動く
- RLSで他ユーザーのデータを取得できない
- プレイブックを登録・選択・バージョン化できる
- required 3 / avoid 2 / invalidation 1を超えない
- エントリー後がAIへ送られない
- 画像確認が必須
- 結果と感情がAIへ送られない
- Structured OutputsとZodが動く
- rule_id集合が完全一致する
- 見送り条件の評価方向が正しい
- 全runが記録される
- 失敗時にkarteがない
- 1karte 1canonical
- 6分類がUIで維持される
- 結果後入力でAI判定が変わらない
- 構造化フィードバックを保存できる
- revisionを作れる
- 画像が保存されない
- 必須テストが通る
- Phase 0Bが作られていない

実装後の報告：

1. 変更ファイル一覧
2. 実装内容
3. 手動セットアップ
4. テスト結果
5. 既知の制約
6. Gate 0A開始手順
