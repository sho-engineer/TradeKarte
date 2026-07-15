import { useId } from "react";

const INK = "#0e1116";
const TEAL = "#5ea8b3";
const TEAL_HI = "#6fc0cb";

/**
 * ポジミルのブランドマーク:「反射するローソク足」。
 * ポジ(上のローソク足)を、ミル(下に薄く映る鏡像)が見つめる形。
 *
 * variant="dark"(既定): 背景は透明で、図形は teal。ライト/ダークどちらの
 *   面に置いても馴染むよう、鏡像はアルファマスクでフェードさせる。
 * variant="teal": teal のタイル + ink の図形(favicon など塗り面が要る場面用)。
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
  const maskId = useId();
  const isTeal = variant === "teal";
  const fg = isTeal ? INK : TEAL;
  const fgHi = isTeal ? INK : TEAL_HI;

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ポジミル"
    >
      <defs>
        {/* 鏡像を下へ向けてフェードさせる(背景色に依存しないアルファマスク) */}
        <linearGradient id={`${maskId}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.72" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${maskId}-mask`}>
          <rect x="0" y="200" width="400" height="200" fill={`url(#${maskId}-grad)`} />
        </mask>
      </defs>

      {isTeal && <rect width="400" height="400" fill={TEAL} />}

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

      {/* 下：反射（ミル）— マスクでフェード */}
      <g mask={`url(#${maskId}-mask)`}>
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
