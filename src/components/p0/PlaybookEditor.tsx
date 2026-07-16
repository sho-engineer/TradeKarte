"use client";

import { useState } from "react";
import {
  validateDraft,
  type PlaybookDraft,
} from "@/lib/p0/playbookLocal";

// プレイブックの新規作成・編集フォーム(機能設計書 v3.3 §3)。
// 編集は呼び出し側で新バージョンとして保存する(既存行を上書きしない)。

interface Props {
  /** 編集時は元プレイブックの下書き、新規時は null */
  initial: PlaybookDraft | null;
  /** 見出し表示用: "新規作成" or "編集(新しい版を作成)" */
  mode: "create" | "edit";
  onSave(draft: PlaybookDraft): void;
  /** オンボーディング(0件)時は戻れないため undefined */
  onCancel?: () => void;
}

function LineInput(props: {
  value: string;
  placeholder: string;
  onChange(v: string): void;
}) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      maxLength={200}
      onChange={(e) => props.onChange(e.target.value)}
      className="w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
    />
  );
}

export default function PlaybookEditor({
  initial,
  mode,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [must, setMust] = useState<string[]>(() => {
    const m = initial?.must ?? [];
    return [m[0] ?? "", m[1] ?? "", m[2] ?? ""];
  });
  const [avoid, setAvoid] = useState<string[]>(() => {
    const a = initial?.avoid ?? [];
    return [a[0] ?? "", a[1] ?? ""];
  });
  const [stop, setStop] = useState(initial?.stop ?? "");
  const [error, setError] = useState<string | null>(null);

  const setAt = (
    list: string[],
    setList: (v: string[]) => void,
    i: number,
    v: string,
  ) => {
    const next = [...list];
    next[i] = v;
    setList(next);
  };

  const submit = () => {
    const draft: PlaybookDraft = { name, must, avoid, stop: stop || null };
    const err = validateDraft(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSave(draft);
  };

  return (
    <div className="tk-card space-y-5 p-5">
      <div>
        <h2 className="text-sm font-bold">
          {mode === "create"
            ? "プレイブックを作成"
            : "プレイブックを編集(新しい版を作成)"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          1行につき1条件。必須は最大3・見送りは最大2・損切りは最大1(合計最大6条件、最低1条件)。
          {mode === "edit" &&
            " 編集しても元の版は変更されず、新しい版として保存されます。"}
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-bold text-muted">プレイブック名</span>
        <LineInput value={name} placeholder="例: 押し目買い" onChange={setName} />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-bold text-muted">
          必須条件(エントリーに必要な条件・最大3)
        </span>
        {must.map((v, i) => (
          <LineInput
            key={`must_${i}`}
            value={v}
            placeholder={`必須条件 ${i + 1}(例: 上位足が上昇トレンド)`}
            onChange={(nv) => setAt(must, setMust, i, nv)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-muted">
          見送り条件(あれば入らない条件・最大2)
        </span>
        {avoid.map((v, i) => (
          <LineInput
            key={`avoid_${i}`}
            value={v}
            placeholder={`見送り条件 ${i + 1}(例: 急騰直後は見送る)`}
            onChange={(nv) => setAt(avoid, setAvoid, i, nv)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-muted">
          損切り・無効化条件(最大1)
        </span>
        <LineInput
          value={stop}
          placeholder="例: 直近安値を明確に下抜けたら無効"
          onChange={setStop}
        />
      </div>

      {error && <p className="text-xs text-impulse">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={submit} className="tk-btn tk-btn--primary">
          保存する
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="tk-btn tk-btn--ghost">
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}
