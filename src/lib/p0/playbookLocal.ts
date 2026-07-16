import { validateRuleIds } from "./dto";
import type { PlaybookRules } from "./types";

// プレイブックの保存とバージョン管理(機能設計書 v3.3 §3)。
//
// ⚠ interim 実装: ポジミル_supabase_phase0.sql 未受領のため、SQL受領までは
//   localStorage に保存する(画像は一切含まないため §5.3 に抵触しない)。
//   受領後は同じ純関数を使って Supabase(RLS)実装へ差し替える。

export interface PlaybookDraft {
  name: string;
  /** 必須条件(1行1条件・最大3) */
  must: string[];
  /** 見送り条件(最大2) */
  avoid: string[];
  /** 損切り・無効化条件(最大1) */
  stop: string | null;
}

export interface StoredPlaybook {
  id: string;
  name: string;
  version: number;
  previous_version_id: string | null;
  rules: PlaybookRules;
  created_at: string;
}

const STORAGE_KEY = "pojimiru_playbooks_v1";

/** 下書きの空行を除去し、rule_id を採番規則どおり割り当てる(§3.3) */
export function draftToRules(draft: PlaybookDraft): PlaybookRules {
  const clean = (lines: string[]) =>
    lines.map((t) => t.trim()).filter((t) => t.length > 0);
  const must = clean(draft.must);
  const avoid = clean(draft.avoid);
  const stop = draft.stop?.trim() || null;
  return {
    must_rules: must.map((text, i) => ({ rule_id: `must_${i + 1}`, text })),
    avoid_rules: avoid.map((text, i) => ({ rule_id: `avoid_${i + 1}`, text })),
    stop_rule: stop ? { rule_id: "stop_1", text: stop } : null,
  };
}

/** 上限(§3.2)・最低1条件・1行1条件を検証。null = OK */
export function validateDraft(draft: PlaybookDraft): string | null {
  if (!draft.name.trim()) return "プレイブック名を入力してください";
  const rules = draftToRules(draft);
  if (rules.must_rules.length > 3) return "必須条件は最大3つです";
  if (rules.avoid_rules.length > 2) return "見送り条件は最大2つです";
  const all = [
    ...rules.must_rules,
    ...rules.avoid_rules,
    ...(rules.stop_rule ? [rules.stop_rule] : []),
  ];
  for (const r of all) {
    if (/[\r\n]/.test(r.text)) return "各条件は1行1条件で入力してください";
    if (r.text.length > 200) return "各条件は200文字以内で入力してください";
  }
  return validateRuleIds(rules);
}

/** 新規作成(version=1)。元データは変更しない純関数 */
export function createPlaybook(
  draft: PlaybookDraft,
  id: string,
  now: string,
): StoredPlaybook {
  return {
    id,
    name: draft.name.trim(),
    version: 1,
    previous_version_id: null,
    rules: draftToRules(draft),
    created_at: now,
  };
}

/**
 * 編集は既存行を上書きせず新バージョンを作る(§3.4):
 * version = old.version + 1、previous_version_id = old.id
 */
export function createNewVersion(
  source: StoredPlaybook,
  draft: PlaybookDraft,
  id: string,
  now: string,
): StoredPlaybook {
  return {
    id,
    name: draft.name.trim(),
    version: source.version + 1,
    previous_version_id: source.id,
    rules: draftToRules(draft),
    created_at: now,
  };
}

/** 新版に置き換えられていない最新バージョンだけを返す(選択UI用) */
export function latestPlaybooks(all: StoredPlaybook[]): StoredPlaybook[] {
  const superseded = new Set(
    all.map((p) => p.previous_version_id).filter(Boolean),
  );
  return all.filter((p) => !superseded.has(p.id));
}

/** 既存プレイブックを下書きへ変換(編集フォーム初期値) */
export function playbookToDraft(pb: StoredPlaybook): PlaybookDraft {
  return {
    name: pb.name,
    must: pb.rules.must_rules.map((r) => r.text),
    avoid: pb.rules.avoid_rules.map((r) => r.text),
    stop: pb.rules.stop_rule?.text ?? null,
  };
}

// --- localStorage IO(ブラウザ専用) ---

export function loadPlaybooks(): StoredPlaybook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredPlaybook[];
  } catch {
    return [];
  }
}

export function savePlaybooks(all: StoredPlaybook[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
