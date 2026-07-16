"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cropImageForReview, type CropResult } from "@/lib/p0/crop";

// チャート画像のブラインドクロップ(機能設計書 v3.3 §5.1)。
// 1. 画像選択 → 2. 縮小プレビュー → 3. エントリー足の右端をタップ →
// 4. クロップ+teal線プレビュー → 5. 確認チェック。
// 元画像・クロップ画像はメモリ上のみで扱い、どこにも保存しない(§5.3)。

const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Props {
  /** クロップ確定+確認チェック済みの画像。null = 未完了 */
  onChange(result: { crop: CropResult; confirmed: boolean } | null): void;
}

export default function ChartCropper({ onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);
  useEffect(() => releaseUrl, [releaseUrl]);

  const emit = useCallback(
    (c: CropResult | null, ok: boolean) => {
      onChange(c ? { crop: c, confirmed: ok } : null);
    },
    [onChange],
  );

  const onFile = (file: File | null) => {
    setCrop(null);
    setConfirmed(false);
    emit(null, false);
    setImage(null);
    setFileName(null);
    releaseUrl();
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("ファイルが大きすぎます(20MBまで)");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name);
    };
    img.onerror = () => {
      setError("画像を読み込めませんでした");
      releaseUrl();
    };
    img.src = url;
  };

  // エントリー足の右端タップ(IMG-004: 未指定では実行不可)
  const onTap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    try {
      const result = cropImageForReview(
        image as HTMLImageElement & { width: number; height: number },
        frac,
      );
      setCrop(result);
      setConfirmed(false);
      emit(result, false);
    } catch {
      setError("画像の処理に失敗しました。別の画像で試してください");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-muted file:mr-3 file:cursor-pointer file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:text-xs file:text-ink hover:file:border-accent"
        />
        {fileName && (
          <p className="mt-1 font-mono text-[11px] text-muted">{fileName}</p>
        )}
      </div>

      {error && <p className="text-xs text-impulse">{error}</p>}

      {image && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted">
            エントリーしたローソク足の右端をタップしてください。タップした位置より右側はAIに送信されません。
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt="チャート画像(タップでエントリー位置を指定)"
            onClick={onTap}
            className="w-full max-w-full cursor-crosshair border border-line"
          />
        </div>
      )}

      {crop && (
        <div className="space-y-3 border border-line p-3">
          <p className="text-xs font-bold text-muted">
            クロップ後プレビュー(この画像だけがAIへ送信されます)
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={crop.dataUrl}
            alt="クロップ後のチャート画像"
            className="max-w-full border border-line"
          />
          <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                emit(crop, e.target.checked);
              }}
              className="mt-0.5 accent-(--accent)"
            />
            <span>
              この画像に、損益・決済結果・エントリー後の情報が含まれていないことを確認しました。
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
