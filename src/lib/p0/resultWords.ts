// 結果語チェック(機能設計書 v3.3 §4.5)。
// 検出しても自動削除はしない。確認ダイアログで修正/続行を選ばせる。

const RESULT_WORD_PATTERNS: RegExp[] = [
  /利確/,
  /勝った/,
  /負けた/,
  /建値/,
  /損切りになった/,
  /そのまま伸びた/,
  /逆行した/,
  /結果的に/,
  /[+＋\-−][0-9０-９]+\s*pips/i,
];

/** エントリー理由に結果語候補が含まれるか(誤検知があるため確認用) */
export function detectResultWords(text: string): string[] {
  const hits: string[] = [];
  for (const p of RESULT_WORD_PATTERNS) {
    const m = p.exec(text);
    if (m) hits.push(m[0]);
  }
  return hits;
}
