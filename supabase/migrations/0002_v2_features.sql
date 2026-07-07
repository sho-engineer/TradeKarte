-- TradeKarte 機能設計書 v2 対応 (docs/feature-design-v2.md)
-- スキーマは初日から全対応。実装フェーズ: F1=Phase 1 / F2=Phase 1.5 / F3・F4=Phase 2
-- 0001 適用済み・未適用のどちらの環境でも通るよう add column if not exists で書く。

-- F2: 実トレード日時(スクショから自動抽出、手動でも可)
alter table public.karte add column if not exists trade_at timestamptz;
-- F2: 約定履歴スクショ(保存はオプトイン。既定は抽出後破棄)
alter table public.karte add column if not exists record_image_url text;
-- F2: 損益(表示・統計用)
alter table public.karte add column if not exists pnl_pips numeric;
-- F1: エントリー前の自己申告感情(冷静/焦り/取り返したい/興奮/不安)
alter table public.karte add column if not exists emotion_pre text;
-- F1: 自己申告とAI判定のズレ
alter table public.karte add column if not exists emotion_gap boolean;
-- F4: 同ユーザーの直前カルテ(行動連鎖の分析用。保存時にサーバー側で自動設定)
alter table public.karte add column if not exists prev_karte_id uuid references public.karte (id);
-- F4: ユーザー内通し番号(保存時にサーバー側で自動設定)
alter table public.karte add column if not exists seq int;

comment on column public.karte.pnl_pips is
  '表示・統計用。AIレビューのプロンプトには渡さない(判定は損益と独立の原則)';

-- F4: 行動連鎖パターン検出の結果(検出は Phase 2 の /api/patterns/scan で実装)
create table if not exists public.pattern_alert (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule text not null,          -- revenge_chain / win_overconfidence / gap_repeat / tag_repeat
  count int not null,
  window_days int default 30,
  detail jsonb,                -- 該当karte_idの配列など
  created_at timestamptz not null default now(),
  dismissed boolean not null default false
);

alter table public.pattern_alert enable row level security;

create policy "pattern_alert_select_own" on public.pattern_alert
  for select to authenticated using (auth.uid() = user_id);
create policy "pattern_alert_insert_own" on public.pattern_alert
  for insert to authenticated with check (auth.uid() = user_id);
create policy "pattern_alert_update_own" on public.pattern_alert
  for update to authenticated using (auth.uid() = user_id);

create index if not exists pattern_alert_user_created_idx
  on public.pattern_alert (user_id, created_at desc);
