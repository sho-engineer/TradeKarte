const INK = "#0e1116";
const TEAL = "#5ea8b3";
const TEAL_HI = "#6fc0cb";

/**
 * ポジミルのブランドマーク:「反射するローソク足」。
 * ポジ(上のローソク足)を、ミル(下に薄く映る鏡像)が見つめる形。
 */
export default function Mark({
  variant = "dark",
  size = 40,
  className,
}: {
  variant?: "dark" | "teal";
  size?: number;
  className?: string;
}) {
  const bg = variant === "dark" ? INK : TEAL;
  const fg = variant === "dark" ? TEAL : INK;
  const fgHi = variant === "dark" ? TEAL_HI : INK;
  const gradientId = `pojimiru-mark-fade-${variant}`;

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ポジミル"
    >
      <rect width="400" height="400" fill={bg} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg} stopOpacity="0" />
          <stop offset="0.85" stopColor={bg} stopOpacity="0.92" />
          <stop offset="1" stopColor={bg} stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* 上：ポジ（ローソク足） */}
      <line
        x1="200"
        y1="58"
        x2="200"
        y2="188"
        stroke={fgHi}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="165" y="96" width="70" height="72" rx="12" fill={fg} />
      {/* 下：反射（ミル） */}
      <g opacity="0.6">
        <line
          x1="200"
          y1="212"
          x2="200"
          y2="342"
          stroke={fgHi}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <rect x="165" y="232" width="70" height="72" rx="12" fill={fg} />
      </g>
      <rect x="0" y="200" width="400" height="200" fill={`url(#${gradientId})`} />
      {/* 鏡面（エントリーマーカーと同じ点線モチーフ） */}
      <line
        x1="70"
        y1="200"
        x2="330"
        y2="200"
        stroke={fg}
        strokeWidth="4"
        strokeDasharray="10 9"
        opacity="0.9"
      />
    </svg>
  );
}
