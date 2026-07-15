import { verdictMeta } from "@/lib/review/verdict";

/**
 * 朱肉の判定印(丸スタンプ)。hero = カルテ見出し用、sm = 台帳の行用。
 */
export default function VerdictStamp({
  verdict,
  size = "hero",
  withLabel = size === "hero",
}: {
  verdict: string;
  size?: "hero" | "sm";
  withLabel?: boolean;
}) {
  const m = verdictMeta(verdict);
  return (
    <div
      className={`tk-stamp tk-stamp--${size}`}
      style={{ borderColor: m.color, color: m.color }}
      aria-label={`判定: ${verdict}`}
    >
      <span className="tk-stamp__mark">{verdict}</span>
      {withLabel && m.en && <span className="tk-stamp__label">{m.en}</span>}
    </div>
  );
}
