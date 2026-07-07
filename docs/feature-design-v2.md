# TradeKarte 機能設計書 v2 — Claude Code 実装用

着手プロンプト（TradeKarte_ClaudeCode_着手プロンプト.md）と一緒に Claude Code に渡す。
本書は追加4機能の設計。**実装フェーズが機能ごとに違う**ので、指定フェーズ以外では作らないこと（スキーマだけは初日から全対応）。

| # | 機能 | 実装時期 |
|---|---|---|
| F1 | 感情セルフタグ | **Phase 1（今すぐ）** |
| F2 | 約定履歴スクショ読み取り | Phase 1.5（継続率確認後） |
| F3 | 自然言語質問（Ask Karte） | Phase 2（Pro強化） |
| F4 | 行動連鎖パターン検出 | Phase 2（DB設計のみ初日から） |

---

## 共通：DBスキーマ改訂（初日にこの形で作る）

```sql
create table karte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  trade_at timestamptz,                -- 実トレード日時（F2で自動抽出、手動でも可）
  image_thumb_url text,
  record_image_url text,               -- F2: 約定履歴スクショ（null可）
  pair text,
  direction text,                      -- ロング/ショート
  result text,                         -- 勝ち/負け/建値/未確定
  pnl_pips numeric,                    -- F2で抽出（null可）。※判定には使わない
  memo text,
  emotion_pre text,                    -- F1: 冷静/焦り/取り返したい/興奮/不安
  verdict text,                        -- エッジ/衝動/混在
  emotion_gap boolean,                 -- F1: 自己申告とAI判定のズレ
  coach text,
  critic text,
  next_action text,
  tags text[],
  prev_karte_id uuid references karte(id),  -- F4: 同ユーザーの直前カルテ
  seq int                              -- F4: ユーザー内通し番号
);
create index idx_karte_user_time on karte(user_id, created_at desc);
create index idx_karte_tags on karte using gin(tags);
```

- `prev_karte_id` と `seq` は**カルテ保存時にサーバー側で自動設定**（同user_idの最新カルテを引く）。F4はPhase 2だが、この2列がないと後から連鎖分析ができないので初日から埋める。
- `pnl_pips` は表示・統計用。**AIレビューのプロンプトには渡さない**（判定は損益と独立、の原則を実装レベルで担保する）。

---

## F1｜感情セルフタグ（Phase 1）

**目的**：入力時の自己申告とAIの客観判定のズレを可視化する。「冷静のつもりだったのに衝動判定」がユーザー最強の気づきになる。

**UI**：入力フォームに1タップのチップ選択を追加。選択肢は5つ固定：
`😌冷静 / 😰焦り / 😤取り返したい / 🤩興奮 / 😟不安`
必須にはしない（未選択可）。デフォルト未選択。

**ロジック**：
1. `emotion_pre` をレビューAPIに渡し、userメッセージに1行追加：
   `エントリー前の自己申告感情: ${emotion_pre ?? "未申告"}`
2. system promptに追記：
   「自己申告感情が提供された場合、チャートとメモから読み取れる実際の行動と自己申告が一致しているかも評価し、乖離があればcriticで具体的に指摘すること。」
3. 出力JSONに `"emotion_gap": true|false` を追加し、DBに保存。
4. カルテUI：ズレがある場合、判定チップの隣に小バッジ「⚡自己認識とズレ」を表示。

**パターン検出との接続**：`emotion_gap=true` が直近30日でN回（初期値3）→ バナー「自己申告『冷静』からの衝動判定が3回目。入る前の状態認識にズレの癖があります」。

---

## F2｜約定履歴スクショ読み取り（Phase 1.5）

**目的**：手入力ゼロ化。日本のブローカーはAPI連携できないため、約定履歴画面（SBI FX等）のスクショをAIで構造化する＝海外勢の「自動取込」の日本版迂回。Pipslog（手入力）への直接優位。

**UI**：入力フォームに2枚目の画像スロット「約定履歴（任意）」を追加。あればpair/direction/result/pnl/trade_atの手入力欄を自動で埋める。

**実装**：
- レビューAPIとは**別エンドポイント** `/api/extract` を作る（責務分離。抽出だけやり直せるように）。
- モデルは `claude-haiku-4-5`（構造化抽出はHaikuで十分。1回≒¥1でコスト最小化）。
- プロンプト方針：
  「これはFXブローカーの約定履歴のスクリーンショット。以下のJSONのみで返す。読み取れない項目はnull。複数トレードが写っている場合は配列で全件返す。」
  ```json
  [{ "pair": "USD/JPY", "direction": "ロング|ショート", "entry_price": 0, "exit_price": 0, "pnl_pips": 0, "pnl_yen": 0, "trade_at": "ISO8601", "lot": 0 }]
  ```
- 複数件返った場合、UIで「どのトレードのカルテを作る?」を選択させる（1カルテ=1トレードの原則は崩さない）。
- 抽出結果はユーザーが修正可能な形でフォームに反映（AI抽出を無検証で確定しない）。
- **プライバシー**：口座残高・氏名・口座番号らしき領域は保存前にユーザーへ「履歴画像は保存しない（抽出後破棄）」をデフォルトにする。record_image_urlの保存はオプトイン。

---

## F3｜自然言語質問 "Ask Karte"（Phase 2・Pro限定）

**目的**：溜まったカルテに日本語で質問できる。「私のFOMOは何曜日に多い?」「判断の負けと確率の負けの比率は?」。判断の質データを持つのは本サービスだけなので、競合が出せない回答になる。

**実装（RAGではなくSQL集計→要約の2段構え。シンプルに作る）**：
1. `/api/ask` エンドポイント。入力：質問文。
2. **Step A（質問→クエリ計画）**：Haikuに質問文と「利用可能な集計軸」（verdict, tags, emotion_pre, emotion_gap, result, 曜日, 時間帯, pair, 直前結果）を渡し、集計仕様JSONを生成させる。
3. **Step B（集計）**：サーバー側で仕様JSONを検証し、**ホワイトリスト化した集計クエリのみ**実行（生成SQLを直接実行しない。SQLインジェクション対策として、軸と条件の組み合わせをパラメタライズドクエリで実装）。
4. **Step C（回答生成）**：集計結果をSonnetに渡し、日本語で2〜4文＋根拠数字の回答を生成。
   - system prompt制約：「回答は過去データの記述のみ。今後の売買への示唆・予測・推奨は出さない」（規制原則をここにも適用）。
5. UI：カルテ一覧ページ上部に質問ボックス。よくある質問3つをチップで提示（「最近の負けパターンは?」等）→空箱問題を回避。
6. **回数制限**：Pro=月30回、Free=不可（ロックUIは見せて課金導線にする）。

---

## F4｜行動連鎖パターン検出（Phase 2・スキーマは初日）

**目的**：タグ一致だけでなく「直前トレードの結果・判定が次の判断に与える影響」を検出する。リサーチが名指しした価値（「負けた後に成績悪化」「勝った後にロット増」）の実装。

**検出ルール（最初はハードコードで4つだけ。MLは不要）**：

| ルール名 | 条件（同一ユーザー・直近30日） | バナー文言例 |
|---|---|---|
| リベンジ連鎖 | 直前result=負け → 次verdict=衝動、がN回 | 「負けの直後に衝動判定が3回。リベンジトレードの連鎖があります」 |
| 勝ち驕り | 直前result=勝ち → 次verdict=衝動、がN回 | 「勝った直後の衝動判定が3回。勝ちの後こそ判断が緩む癖」 |
| 認識ズレ反復 | emotion_gap=true がN回 | （F1参照） |
| タグ反復 | 同一tagsを含む衝動判定がN回 | 「高値掴みFOMO：30日で3回目」 |

- 実装：カルテ保存後に非同期で `/api/patterns/scan` を叩き、検出結果を `pattern_alert` テーブルに保存 → 次回カルテ表示時にバナー表示。
- `prev_karte_id` を辿るだけの単純クエリで全ルール実装可能。
- **Free/Proの出し分け**：Freeは「⚠繰り返しパターンを検出しました」まで（中身はぼかす）。Proで全文＋履歴リンク。ここが課金トリガーの本体。

```sql
create table pattern_alert (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rule text not null,          -- revenge_chain / win_overconfidence / gap_repeat / tag_repeat
  count int not null,
  window_days int default 30,
  detail jsonb,                -- 該当karte_idの配列など
  created_at timestamptz default now(),
  dismissed boolean default false
);
```

---

## Claude Codeへの実装順序の指示

1. スキーマは本書の改訂版で最初から作成（F2〜F4の列・テーブル含む）
2. Phase 1実装時：F1のみ組み込む（フォームのチップ、プロンプト追記、emotion_gap保存、バナー1種）
3. F2/F3/F4は**ディレクトリとエンドポイントの空実装（ルーティングだけ）を切っておき、中身はコメントで本書参照**と書く
4. pnl系の値がレビューAPIのプロンプトに混入しないことをテストで担保（「判定と損益の独立」はテスト項目にする）
