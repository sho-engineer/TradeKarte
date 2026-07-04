export interface PatternSource {
  tags: string[] | null;
  verdict: string | null;
}

/** 直近30日で同じタグ/「衝動」判定が繰り返されていたら警告文を返す(current 自身を1回目として数える) */
export function detectPatterns(
  current: { tags: string[]; verdict: string },
  history: PatternSource[],
  threshold = 3,
): string[] {
  const warnings: string[] = [];

  for (const tag of current.tags) {
    const count = history.filter((h) => h.tags?.includes(tag)).length + 1;
    if (count >= threshold) {
      warnings.push(`「${tag}」:直近30日で${count}回目`);
    }
  }

  if (current.verdict === "衝動") {
    const count = history.filter((h) => h.verdict === "衝動").length + 1;
    if (count >= threshold) {
      warnings.push(`判定「衝動」:直近30日で${count}回目`);
    }
  }

  return warnings;
}

export const PATTERN_WINDOW_DAYS = 30;

export function patternWindowStart(from: Date = new Date()): string {
  return new Date(
    from.getTime() - PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}
