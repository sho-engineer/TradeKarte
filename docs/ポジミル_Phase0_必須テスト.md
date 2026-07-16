# ポジミル Phase 0A 必須テスト

**同期版リビジョン**：v3.3.1
**最終更新**：2026-07-15
**対象**：Phase 0Aのみ

外部公開前に全項目を確認します。
特に「AIリクエスト」と「AI出力・保存」は自動テスト必須です。

---

## 0. テスト方針

### 自動化必須

- アクセスコード検証
- リクエストDTO
- 結果・感情非送信
- 画像クロップ
- JSON Schema
- Zod
- rule_id完全一致
- required / avoid / invalidation評価方向
- ai_review_run状態遷移
- 失敗時karte非作成
- canonical一意性
- RLSユーザー分離
- 結果後入力でAI非再実行

### 手動確認を併用

- スマホでのタップUX
- クロッププレビュー
- 日本語表示
- 画像がログへ出ていないこと
- 匿名認証の注意文
- 実モデルの画像読解品質

Anthropic APIは通常テストではモックし、少数の明示的な統合テストだけ実APIを使います。

---

## 1. アクセスコード

### ACCESS-001 正しいコード

期待：

- `/api/access`が成功
- 署名済みHttpOnly Cookieが設定される
- `/app`へ入れる
- `/api/review`へ進める

### ACCESS-002 間違ったコード

期待：

- 401または403
- Cookieを発行しない
- `/app`へ入れない

### ACCESS-003 Cookie改ざん

期待：

- 署名検証失敗
- `/app`と`/api/review`の両方で拒否

### ACCESS-004 CookieなしでAPI直叩き

期待：

- `/api/review`を拒否
- Anthropic APIを呼ばない
- ai_review_runを作らない

### ACCESS-005 秘密情報

期待：

- `APP_ACCESS_CODE`と`APP_ACCESS_COOKIE_SECRET`がクライアントバンドルにない
- Cookieにアクセスコード平文を入れない

---

## 2. Supabase Anonymous Sign-In・RLS

### AUTH-001 匿名サインイン

期待：

- メール入力なしでユーザーID発行
- `authenticated`ロール
- リロード後にセッション復元

### AUTH-002 user_id本文無視

悪意あるリクエストに別ユーザーIDを含める。

期待：

- DTOにuser_idがない、またはstrip/reject
- 保存user_idはSupabaseセッション由来

### RLS-001 playbook分離

ユーザーAの行をユーザーBがSELECT。

期待：

- 不可

### RLS-001B playbook不変性

authenticatedクライアントが自分の既存playbookをUPDATE / DELETE。

期待：

- 不可
- 編集は新バージョンINSERTだけ

### RLS-002 karte分離

期待：

- 他人のカルテを取得できない

### RLS-002B karte直接書き込み禁止

authenticatedクライアントが自分のkarteをINSERT / UPDATE / DELETE。

期待：

- 不可
- 結果・feedback・revisionはサーバーRoute Handler経由だけ

### RLS-003 ai_review_run分離

期待：

- 他人のrunを取得できない

### RLS-004 run書き込み

authenticatedクライアントから直接INSERT / UPDATE / DELETE。

期待：

- 不可
- service_role経由だけ成功

---

## 3. プレイブック

### PB-001 最低1条件

全条件0件。

期待：

- UIまたはDBで拒否

### PB-002 上限

- required 4件
- avoid 3件
- stop 2件相当

期待：

- UIまたはDBで拒否

### PB-003 rule_id

期待：

- must_1〜must_3
- avoid_1〜avoid_2
- stop_1
- 欠番・重複なし

### PB-004 不正JSON

例：

```json
[{"rule_id":"must_2","text":"条件"}]
```

1件目がmust_2。

期待：

- DB制約で拒否

### PB-005 初回オンボーディング

保存済み0件。

期待：

- レビュー入力へ進む前に登録必須
- 最低1個で開始可能
- 2〜3個推奨表示

### PB-006 既存選択

期待：

- 新規playbook行を作らない
- 両フラグfalse
- snapshot保存

### PB-007 編集

期待：

- 元行不変
- 新行
- version+1
- previous_version_id
- editedフラグtrue

### PB-008 振り返り時新規作成

期待：

- createdフラグtrue
- editedフラグfalse

---

## 4. 入力フォーム

### FORM-001 必須項目

欠落：

- trade_at
- trade_timezone
- image
- entry position
- blind confirmation
- pair
- direction
- playbook
- entry_reason
- memory_source

期待：

- 実行不可

### FORM-002 timezone

期待：

- IANA timezoneを保存
- trade_atはtimestamptz
- created_atと別

### FORM-003 memory_source

期待：

- `recorded_at_time`
- `from_memory`
以外を拒否

### FORM-004 direction

期待：

- `long`
- `short`
以外を拒否

### FORM-005 emotion

期待：

- 任意
- 5内部キーだけ
- AIリクエストに含まれない

### FORM-006 結果語なし

期待：

- detected=false
- overridden=false
- blind_integrity=clean

### FORM-007 結果語検出後に修正

最終送信時に結果語なし。

期待：

- detected=false
- overridden=false
- blind_integrity=clean

### FORM-008 結果語検出後に続行

期待：

- detected=true
- overridden=true
- blind_integrity=warning_overridden

---

## 5. 画像

### IMG-001 非画像

期待：拒否

### IMG-002 サイズ上限

期待：過大ファイルを拒否

### IMG-003 リサイズ

長辺2000px。

期待：

- 送信画像長辺1280px以下
- JPEG quality 0.85

### IMG-004 位置必須

期待：未指定で実行不可

### IMG-005 マージンなしクロップ

幅1000、x=600。

期待：

- 出力幅600相当
- x>600の画素が存在しない
- 2%等の追加余白なし

### IMG-006 最小幅

xが40未満。

期待：

- cutX=40

### IMG-007 ティール線

期待：

- 右端
- #5EA8B3
- 3px

### IMG-008 プレビュー確認

未チェック。

期待：

- APIを呼ばない
- 成功karteを作らない

### IMG-009 画像非保存

確認対象：

- DB
- Storage
- localStorage
- IndexedDB
- server logs
- error monitoring
- raw_response

期待：

- 元画像・クロップ画像・base64なし

---

## 6. AIリクエスト：自動テスト必須

### AI-REQ-001 許可フィールド

AIへ渡す情報だけをsnapshotテスト。

期待：

- cropped image
- pair
- direction
- normalized rules
- entry_reason

### AI-REQ-002 結果非送信

入力オブジェクトに以下を存在させたテストデータからAI payloadを生成。

- result
- pnl_pips
- exit_reason

期待：

- AI payloadにキーなし
- 文字列値もpromptへ混入しない

### AI-REQ-003 感情非送信

期待：

- emotion_preキーなし
- 値もpromptへ混入しない

### AI-REQ-004 user_id非送信・非信用

期待：

- DTOにuser_idなし
- payloadにuser_idなし
- DB user_idはsession由来

### AI-REQ-005 元画像非送信

期待：

- cropped imageだけ
- original image参照なし

### AI-REQ-006 System Prompt固定

期待：

- 設計書の確定System Promptと文字列一致
- snapshotまたはhashで回帰検知

### AI-REQ-007 Structured Outputs現行形

期待：

- `output_config.format.type=json_schema`
- 旧beta header依存なし
- raw API payloadへ旧`output_format`なし

### AI-REQ-008 APIキー非公開

期待：

- ブラウザNetworkにAnthropic APIキーなし
- クライアントバンドルにキーなし

---

## 7. AI出力・Zod：自動テスト必須

### AI-OUT-001 正常出力

期待：

- JSON Schema適合
- Zod適合
- exact rule validation適合

### AI-OUT-002 assessment未知値

`"assessment":"great"`

期待：

- 失敗
- karteなし
- run failed / zod_validation

### AI-OUT-003 confidence未知値

期待：失敗

### AI-OUT-004 配列上限

- facts 5
- behavior 3
- missing 5
- rule_check 7

期待：失敗、黙って切り捨てない

### AI-OUT-005 rule_id不足

入力6条件、出力5条件。

期待：

- 失敗
- karteなし

### AI-OUT-006 rule_id追加

入力にないID。

期待：失敗

### AI-OUT-007 rule_id重複

期待：失敗

### AI-OUT-008 rule_text改変

期待：失敗

### AI-OUT-009 rule_type改変

期待：失敗

### AI-OUT-010 required評価方向

- observation=met / adherence=compliant → 成功
- observation=met / adherence=violated → 失敗
- observation=not_met / adherence=violated → 成功

### AI-OUT-011 avoid評価反転

- observation=met / adherence=violated → 成功
- observation=met / adherence=compliant → 失敗
- observation=not_met / adherence=compliant → 成功

### AI-OUT-012 invalidation評価

- observation=met / adherence=violated → 成功
- observation=not_met / adherence=compliant → 成功
- unknown / unknown → 成功

### AI-OUT-013 unknown対応

observation=unknownでadherenceがcompliantまたはviolated。

期待：失敗

### AI-OUT-014 reflection_question空

期待：失敗

### AI-OUT-015 reflection_question指示

例：

- 次回は見送ってください
- 確認してみてください

期待：

- アプリ側検査で失敗またはGate評価フラグ
- 少なくとも疑問文でないものは拒否

### AI-OUT-016 心理断定

例：

- 焦っている
- FOMO状態
- 取り返そうとしている

期待：

- プロンプト上禁止
- テストfixtureで品質警告または拒否ロジック対象

### AI-OUT-017 refusal

期待：

- HTTP 200でも失敗
- run failure_stage=refusal
- karteなし

### AI-OUT-018 max_tokens

期待：

- run failure_stage=max_tokens
- karteなし

### AI-OUT-019 HTTPエラー

期待：

- run failed
- http_status保存
- karteなし

---

## 8. ai_review_run・保存

### RUN-001 running作成

期待：

- API前にrunning
- karte_id=null
- session user_id
- model/prompt/schema保存

### RUN-002 初回成功

期待：

- RPC成功
- karte 1件
- run succeeded
- run.karte_id設定
- is_canonical=true

### RUN-003 初回失敗

期待：

- run failed
- karte 0件

### RUN-004 パース失敗

期待：

- karte 0件
- failure_stage適切

### RUN-005 再実行

既存karteで再実行。

期待：

- 新karteなし
- 新run
- same karte_id
- is_canonical=false

### RUN-006 モデル比較

期待：

- 比較runが通常トレード件数を増やさない
- experiment_idでまとめられる
- canonical=false

### RUN-007 canonical一意

同一karteへ2件canonical。

期待：

- DB unique indexで拒否

### RUN-008 RPC権限

authenticatedクライアントがRPC直接実行。

期待：

- 権限拒否

### RUN-009 raw_response安全性

期待：

- 画像なし
- base64なし
- APIキーなし
- リクエスト全文なし

---

## 9. 6分類UI

### CLASS-001 全分類

期待：

- ruleok
- insufficient
- violation
- impulse
- mix
- unknown

を別表示。

### CLASS-002 圧縮禁止

期待：

- insufficientをunknownへ変えない
- impulseをviolationへ変えない

### CLASS-003 class安全性

期待：

- AI生文字列をclassへ入れない
- 検証済み内部キーだけ

### CLASS-004 rule_check表示

期待：

- observationとadherenceを別表示
- avoidで「条件を確認した」ことが遵守ではないと分かる

---

## 10. 感情表示

### EMO-001 並列

期待：

- 自己申告
- behavior_signals
を別表示。

### EMO-002 断定禁止

以下を自動表示しない：

- 感情が原因
- 自己認識が正しい
- 一致
- 不一致

---

## 11. 結果後入力

### RESULT-001 保存

期待：

- win / loss / breakeven
- pips
- exit_reason

### RESULT-002 AI非再実行

期待：

- Anthropic呼び出し0回
- assessment不変
- ai_review_run増加なし

### RESULT-003 revision非作成

期待：

- 結果入力だけで新karteなし

---

## 12. フィードバック

### FB-001 helpful

期待：保存

### FB-002 partial

期待：

- incorrect_area複数
- corrected_assessment
- comment

### FB-003 不正area

期待：DBまたはZodで拒否

### FB-004 enum一致

DB / API / TS / UI mapping一致。

---

## 13. revision_of

### REV-001 入力訂正

期待：

- 新karte
- revision_of=元ID
- 元karte不変
- 新canonical run

### REV-002 結果だけ

期待：revisionなし

### REV-003 他人のkarte

期待：revision元に指定できないようサーバー検証

---

## 14. レート制限

### RATE-001 5回以内

期待：許可

### RATE-002 6回目

期待：

- 429
- Anthropic非実行
- run非作成

### RATE-003 ユーザー分離

期待：

- Aの制限がBへ影響しない

---

## 15. 回帰・スコープ

### REG-001 画像列なし

期待：

- karteにimage URL/base64列なし

### REG-002 旧ai_review_attemptなし

期待：

- ai_review_runだけ

### REG-003 旧日本語enumなし

期待：

- DB/APIは英語内部キー

### REG-004 旧rule_checkなし

期待：

- statusだけの旧形式を使わない

### REG-005 Phase 0Bなし

期待：

- `/app/trends`なし
- 集計SQLなし
- 空ルートなし

### REG-006 作らないもの

期待：

- Stripe
- MT4/5
- TradingView
- OGP
- Xシェア
- 自動アラート
- 週次レポート
が追加されていない

---

## 外部公開前の合格条件

- TypeScript型チェック成功
- lint成功
- unit test成功
- integration test成功
- 必須E2E成功
- RLSを実ユーザーA/Bで確認
- 結果・感情非送信を自動テストで確認
- クロップをpixel単位で確認
- rule mappingを自動テストで確認
- 失敗時karte 0件
- 1karte 1canonical
- 画像非保存
- Phase 0B未実装
- 実モデルで少数の手動確認
