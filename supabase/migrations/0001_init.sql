-- TradeKarte Phase 1: karte テーブル + サムネイル用 Storage バケット
-- Supabase SQL Editor に貼り付けるか、`supabase db push` で適用する。

create table if not exists public.karte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  image_thumb_url text,          -- storage 上のオブジェクトパス (karte-thumbs バケット内)
  pair text,
  direction text,                -- ロング/ショート
  result text,                   -- 勝ち/負け/建値/未確定
  memo text,
  verdict text not null,         -- エッジ/衝動/混在
  coach text not null,
  critic text not null,
  next_action text not null,
  tags text[] not null default '{}'   -- パターン検出のクエリ対象
);

alter table public.karte enable row level security;

create policy "karte_select_own" on public.karte
  for select to authenticated using (auth.uid() = user_id);
create policy "karte_insert_own" on public.karte
  for insert to authenticated with check (auth.uid() = user_id);
create policy "karte_delete_own" on public.karte
  for delete to authenticated using (auth.uid() = user_id);

-- 履歴一覧・無料枠カウント・パターン検出(直近30日)用
create index if not exists karte_user_created_idx
  on public.karte (user_id, created_at desc);
create index if not exists karte_tags_gin_idx
  on public.karte using gin (tags);

-- サムネイル保存用の非公開バケット。パス先頭を user_id にして本人のみ読み書き可。
insert into storage.buckets (id, name, public)
values ('karte-thumbs', 'karte-thumbs', false)
on conflict (id) do nothing;

create policy "thumbs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'karte-thumbs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "thumbs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'karte-thumbs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "thumbs_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'karte-thumbs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
