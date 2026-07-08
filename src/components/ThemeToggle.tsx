"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

// SSR と初回クライアント描画を一致させる(no-flash スクリプトが実DOMを確定するので
// ここは既定のダークを返し、ハイドレーション後に getSnapshot が補正する)。
function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(next: Theme) {
  document.documentElement.classList.toggle("light", next === "light");
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* localStorage 不可でも切替自体は動く */
  }
  listeners.forEach((cb) => cb());
}

const SunIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
    <path
      d="M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const goingTo: Theme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(goingTo)}
      className="tk-theme-toggle"
      aria-label={
        goingTo === "dark" ? "ダークモードに切替" : "ライトモードに切替"
      }
      title={goingTo === "dark" ? "ダークモード" : "ライトモード"}
      suppressHydrationWarning
    >
      {theme === "light" ? MoonIcon : SunIcon}
    </button>
  );
}
